begin;

create function public.kollab_admin_queue(queue text default 'reviews') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_moderator(); result jsonb; begin
  if queue='reviews' then
    select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (
      select r.id,'review' kind,c.name title,r.body,r.visibility status,r.created_at,private.review_json(r) review
      from private.reviews r join private.companies c on c.id=r.brand_id where r.visibility='pending_review' order by r.created_at limit 100
    ) x;
  elsif queue='companies' then
    select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (
      select id,'company' kind,name title,instagram_handle body,status,created_at,private.company_json(c) company
      from private.companies c where status='pending_review' order by created_at limit 100
    ) x;
  elsif queue='verifications' then
    select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (
      select id,'verification' kind,'@'||handle title,code body,status,created_at,handle,code,expires_at
      from private.verification_challenges where status='submitted' and expires_at>now() order by created_at limit 100
    ) x;
  elsif queue='posts' then
    select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (
      select id,'post' kind,category title,body,visibility status,created_at from private.posts where visibility='pending_review' order by created_at limit 100
    ) x;
  elsif queue='comments' then
    select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (
      select id,'comment' kind,'Room comment' title,body,visibility status,created_at,post_id from private.comments where visibility='pending_review' order by created_at limit 100
    ) x;
  elsif queue='proofs' then
    select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (
      select id,'proof' kind,proof_type title,'Private evidence — open secure preview to inspect.' body,verdict status,created_at,review_id
      from private.review_proofs where verdict='pending' and upload_state='uploaded' and delete_after>now() order by created_at limit 100
    ) x;
  elsif queue='reports' then
    select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (
      select r.id,'report' kind,r.target_type||' report' title,r.reason body,r.status,r.created_at,r.target_id,r.target_type,
        case r.target_type when 'review' then (select body from private.reviews where id=r.target_id)
          when 'post' then (select body from private.posts where id=r.target_id)
          when 'comment' then (select body from private.comments where id=r.target_id) end content
      from private.reports r where status='open' order by created_at limit 100
    ) x;
  elsif queue='claims' then
    select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (
      select cl.id,'claim' kind,c.name title,cl.evidence body,cl.status,cl.created_at,cl.company_id
      from private.brand_claims cl join private.companies c on c.id=cl.company_id where cl.status='pending_review' order by cl.created_at limit 100
    ) x;
  elsif queue='replies' then
    select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (
      select br.id,'reply' kind,c.name title,br.body,br.visibility status,br.created_at,br.review_id
      from private.brand_replies br join private.reviews r on r.id=br.review_id join private.companies c on c.id=r.brand_id
      where br.visibility='pending_review' order by br.created_at limit 100
    ) x;
  elsif queue='audit' then
    select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (
      select id,'audit' kind,action title,reason body,'recorded' status,created_at,target_id,actor,before_state,after_state
      from private.moderation_actions order by created_at desc,id desc limit 100
    ) x;
  else raise exception 'Unknown moderation queue.'; end if;
  return result;
end $$;

create function public.kollab_admin_action(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=private.require_moderator(); a text:=input->>'action'; t uuid:=(input->>'target_id')::uuid;
  decision text:=input->>'decision'; reason text:=trim(input->>'reason'); before_data jsonb; after_data jsonb;
  owner_id uuid; company uuid; c private.verification_challenges; destination uuid; n integer;
begin
  perform private.assert_input(input,array['action','target_id','decision','reason','merge_into_id']);
  if reason is null or length(reason) not between 5 and 1000 then raise exception 'An audit reason of 5–1000 characters is required.'; end if;
  perform private.throttle('moderation',300);
  if a='review' then
    select to_jsonb(r),r.user_id,r.brand_id into before_data,owner_id,company from private.reviews r where id=t for update;
    if before_data is null then raise exception 'Review unavailable.'; end if;
    if owner_id=actor_id then raise exception 'Another moderator must review your content.'; end if;
    if decision not in ('published','removed') or decision is null then raise exception 'Invalid review decision.'; end if;
    if decision='published' and (not exists(select 1 from private.companies where id=company and status='active')
      or exists(select 1 from private.profiles where user_id=owner_id and banned_at is not null)) then raise exception 'Company or creator unavailable.'; end if;
    update private.reviews set visibility=decision::private.publication_state where id=t;
    -- Invalidate cells containing a removed review immediately; no stale projection.
    if decision='removed' then delete from private.rate_cells where members ? owner_id::text and members->>owner_id::text=t::text; end if;
    if before_data->>'visibility'<>decision then
      insert into private.notifications(user_id,brand_id,message) values(owner_id,company,case decision when 'published' then 'Your review was published.' else 'Your review is no longer published. Contact support if you would like to appeal.' end);
      if decision='published' then
        insert into private.notifications(user_id,brand_id,message) select user_id,company,'A new creator review is available for a company you saved.' from private.watchlist where brand_id=company and user_id<>owner_id;
      end if;
    end if;
    after_data:=jsonb_build_object('visibility',decision);
  elsif a='company' then
    select to_jsonb(cmp),created_by into before_data,owner_id from private.companies cmp where id=t for update;
    if before_data is null then raise exception 'Company unavailable.'; end if;
    if before_data->>'status'='merged' then raise exception 'Merged companies cannot be republished.'; end if;
    if decision not in ('active','hidden') or decision is null then raise exception 'Invalid company decision.'; end if;
    if decision='active' and owner_id=actor_id then raise exception 'Another moderator must approve your company.'; end if;
    update private.companies set status=decision::private.company_state where id=t;
    after_data:=jsonb_build_object('status',decision);
  elsif a='verification' then
    select * into c from private.verification_challenges where id=t for update;
    if c.id is null or c.status<>'submitted' or c.expires_at<=now() then raise exception 'Challenge unavailable or expired.'; end if;
    if c.user_id=actor_id then raise exception 'Another moderator must verify your account.'; end if;
    if decision not in ('approved','rejected') or decision is null then raise exception 'Invalid verification decision.'; end if;
    before_data:=jsonb_build_object('status',c.status,'handle',c.handle);
    if decision='approved' then
      if exists(select 1 from private.instagram_verifications where handle=c.handle and user_id<>c.user_id)
        then raise exception 'Handle is already associated with an account; resolve the ownership dispute first.'; end if;
      insert into private.instagram_verifications(user_id,handle,method,verified_by)
        values(c.user_id,c.handle,'manual_bio',actor_id) on conflict(user_id) do update set handle=excluded.handle,
        verified_at=now(),expires_at=now()+interval '90 days',verified_by=actor_id,method='manual_bio';
    end if;
    update private.verification_challenges set status=decision,reviewed_at=now() where id=t;
    insert into private.notifications(user_id,message) values(c.user_id,case decision when 'approved' then 'Instagram ownership verified. You can now submit reviews.' else 'Instagram verification needs another attempt. Generate a new bio code when ready.' end);
    after_data:=jsonb_build_object('status',decision);
  elsif a in ('post','comment','reply') then
    if decision not in ('published','removed') or decision is null then raise exception 'Invalid publication decision.'; end if;
    if a='post' then
      select jsonb_build_object('visibility',visibility),user_id into before_data,owner_id from private.posts where id=t for update;
    elsif a='comment' then
      select jsonb_build_object('visibility',visibility),user_id into before_data,owner_id from private.comments where id=t for update;
    else
      select jsonb_build_object('visibility',visibility),user_id into before_data,owner_id from private.brand_replies where id=t for update;
    end if;
    if before_data is null then raise exception 'Content unavailable.'; end if;
    if owner_id=actor_id then raise exception 'Another moderator must review your content.'; end if;
    if decision='published' and exists(select 1 from private.profiles where user_id=owner_id and banned_at is not null) then raise exception 'Account unavailable.'; end if;
    if a='post' then update private.posts set visibility=decision::private.publication_state where id=t;
    elsif a='comment' then update private.comments set visibility=decision::private.publication_state where id=t;
    else update private.brand_replies set visibility=decision::private.publication_state where id=t; end if;
    after_data:=jsonb_build_object('visibility',decision);
    if before_data->>'visibility'<>decision then insert into private.notifications(user_id,message) values(owner_id,'Your community contribution was reviewed: '||decision||'.'); end if;
  elsif a='proof' then
    select jsonb_build_object('verdict',p.verdict),r.user_id,p.review_id into before_data,owner_id,company
      from private.review_proofs p join private.reviews r on r.id=p.review_id where p.id=t and p.upload_state='uploaded' and p.delete_after>now() for update of p;
    if before_data is null then raise exception 'Proof unavailable.'; end if;
    if owner_id=actor_id then raise exception 'Another moderator must verify your proof.'; end if;
    if decision not in ('verified','rejected') or decision is null then raise exception 'Invalid proof decision.'; end if;
    update private.review_proofs set verdict=decision,reviewed_by=actor_id,reviewed_at=now() where id=t;
    update private.reviews set proof_status=case when exists(select 1 from private.review_proofs where review_id=company and verdict='verified' and upload_state='uploaded') then 'verified'
      when exists(select 1 from private.review_proofs where review_id=company and verdict='pending' and upload_state='uploaded') then 'pending' else 'rejected' end where id=company;
    update private.reviews set trust_score=case when proof_status='verified' then 1 else 0.5 end where id=company;
    after_data:=jsonb_build_object('verdict',decision);
  elsif a='report' then
    select jsonb_build_object('status',status,'target_id',target_id) into before_data from private.reports where id=t for update;
    if before_data is null then raise exception 'Report unavailable.'; end if;
    if decision not in ('resolved','dismissed') or decision is null then raise exception 'Invalid report decision.'; end if;
    update private.reports set status=decision where id=t;
    after_data:=jsonb_build_object('status',decision);
  elsif a='claim' then
    select jsonb_build_object('status',status,'company_id',company_id),user_id into before_data,owner_id from private.brand_claims where id=t for update;
    if before_data is null then raise exception 'Claim unavailable.'; end if;
    if owner_id=actor_id then raise exception 'Another moderator must review your claim.'; end if;
    if decision not in ('approved','rejected','revoked') or decision is null then raise exception 'Invalid claim decision.'; end if;
    update private.brand_claims set status=decision where id=t;
    after_data:=jsonb_build_object('status',decision);
  elsif a='ban' then
    perform private.require_moderator(true);
    if t=actor_id or exists(select 1 from private.user_roles where user_id=t) then raise exception 'Role holders must be managed by the database owner.'; end if;
    select jsonb_build_object('banned',banned_at is not null) into before_data from private.profiles where user_id=t for update;
    if before_data is null then raise exception 'Account unavailable.'; end if;
    if decision not in ('banned','active') or decision is null then raise exception 'Invalid account decision.'; end if;
    update private.profiles set banned_at=case when decision='banned' then now() end where user_id=t;
    if decision='banned' then
      update private.reviews set visibility='removed' where user_id=t;
      update private.posts set visibility='removed' where user_id=t;
      update private.comments set visibility='removed' where user_id=t;
      update private.brand_replies set visibility='removed' where user_id=t;
      update private.brand_claims set status='revoked' where user_id=t and status='approved';
      delete from private.rate_cells where members ? t::text;
    end if;
    after_data:=jsonb_build_object('banned',decision='banned');
  elsif a='merge' then
    perform private.require_moderator(true); destination:=(input->>'merge_into_id')::uuid;
    if destination is null or destination=t then raise exception 'Choose a different active destination company.'; end if;
    -- Stable lock ordering prevents concurrent inverse merges and deadlocks.
    perform 1 from private.companies where id in (t,destination) order by id for update;
    select to_jsonb(cmp) into before_data from private.companies cmp where id=t and status in ('active','pending_review');
    if before_data is null or not exists(select 1 from private.companies where id=destination and status='active' and entity_type=before_data->>'entity_type') then raise exception 'Invalid company merge.'; end if;
    if exists(select 1 from private.brand_claims where company_id=t and status='approved') then raise exception 'Resolve the existing brand claim before merging.'; end if;
    if exists(select 1 from private.reviews src join private.reviews dest on dest.user_id=src.user_id and dest.collab_month=src.collab_month where src.brand_id=t and dest.brand_id=destination)
      then raise exception 'Duplicate collaboration months require manual review before merging.'; end if;
    update private.reviews set brand_id=destination where brand_id=t;
    update private.reviews set agency_id=destination where agency_id=t;
    insert into private.watchlist(user_id,brand_id) select user_id,destination from private.watchlist where brand_id=t on conflict do nothing;
    delete from private.watchlist where brand_id=t;
    insert into private.company_aliases values(destination,before_data->>'name'),(destination,before_data->>'instagram_handle') on conflict do nothing;
    insert into private.company_aliases select destination,alias from private.company_aliases where company_id=t on conflict do nothing;
    update private.companies set status='merged',merged_into_id=destination where id=t;
    delete from private.rate_cells where brand_id in (t,destination);
    after_data:=jsonb_build_object('status','merged','merged_into_id',destination);
  elsif a='refresh_rates' then
    n:=private.refresh_rates(); t:=coalesce(t,actor_id); before_data:='{}'; after_data:=jsonb_build_object('updated_cells',n);
  else raise exception 'Unknown moderation action.'; end if;
  insert into private.moderation_actions(actor,target_id,action,reason,before_state,after_state)
    values(actor_id::text,t,a||':'||coalesce(decision,''),reason,before_data,after_data);
  return jsonb_build_object('ok',true,'result',after_data);
end $$;

create function public.kollab_sitemap(after_slug text default '', result_limit integer default 500) returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('slug',c.slug,'entity_type',c.entity_type)),'[]'::jsonb) from (
    select c.slug,c.entity_type from private.companies c where c.status='active' and c.slug>left(after_slug,160)
      and exists(select 1 from private.reviews r where (r.brand_id=c.id or r.agency_id=c.id) and r.visibility='published')
    order by c.slug limit greatest(1,least(result_limit,1000))
  ) c;
$$;
create function public.kollab_resolve_slug(slug text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c private.companies; n integer:=0; begin
  select * into c from private.companies where companies.slug=left(kollab_resolve_slug.slug,160) and status in ('active','merged');
  while c.status='merged' and n<20 loop
    select * into c from private.companies where id=c.merged_into_id and status in ('active','merged'); n:=n+1;
  end loop;
  if c.id is null or c.status<>'active' then return null; end if;
  return jsonb_build_object('slug',c.slug,'entity_type',c.entity_type,'id',c.id);
end $$;

revoke all on function public.kollab_admin_queue(text),public.kollab_admin_action(jsonb),public.kollab_sitemap(text,integer),public.kollab_resolve_slug(text) from public,anon,authenticated;
grant execute on function public.kollab_admin_queue(text),public.kollab_admin_action(jsonb) to authenticated;
grant execute on function public.kollab_sitemap(text,integer),public.kollab_resolve_slug(text) to anon,authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
commit;
