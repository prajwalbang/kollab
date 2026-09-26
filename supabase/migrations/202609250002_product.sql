-- Run after the foundation migration. No client table access, including moderators.
begin;

create table private.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('moderator','admin')),
  assigned_at timestamptz not null default now()
);
create table private.verification_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  handle text not null check(handle ~ '^[a-z0-9._]{1,30}$'),
  code text not null default ('KOLLAB-' || upper(replace(gen_random_uuid()::text,'-',''))),
  status text not null default 'pending' check(status in ('pending','submitted','approved','rejected','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  submitted_at timestamptz,
  reviewed_at timestamptz
);
create index verification_owner_idx on private.verification_challenges(user_id,created_at desc);
create unique index verification_one_active_idx on private.verification_challenges(user_id) where status in ('pending','submitted');

create table private.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  category text not null check(category in ('Beauty','Fashion','Tech','Food & drink','Lifestyle','Fitness','Agency','Other')),
  body text not null check(length(trim(body)) between 5 and 2000),
  identity_mode private.identity_mode not null default 'anonymous',
  attribution_handle text,
  attribution_consent_at timestamptz,
  visibility private.publication_state not null default 'pending_review',
  created_at timestamptz not null default now(),
  check((identity_mode='anonymous' and attribution_handle is null and attribution_consent_at is null)
    or (identity_mode='attributed' and attribution_handle is not null and attribution_consent_at is not null))
);
create index posts_search_idx on private.posts using gin(to_tsvector('english',body));
create index posts_category_idx on private.posts(category,visibility,created_at desc);
create table private.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references private.posts(id),
  user_id uuid not null references auth.users(id),
  body text not null check(length(trim(body)) between 1 and 1000),
  identity_mode private.identity_mode not null default 'anonymous',
  attribution_handle text,
  attribution_consent_at timestamptz,
  visibility private.publication_state not null default 'pending_review',
  created_at timestamptz not null default now(),
  check((identity_mode='anonymous' and attribution_handle is null and attribution_consent_at is null)
    or (identity_mode='attributed' and attribution_handle is not null and attribution_consent_at is not null))
);
create index comments_parent_idx on private.comments(post_id,visibility);
create table private.votes (
  user_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null,
  primary key(user_id,target_id)
);
alter table private.reports alter column review_id drop not null;
alter table private.reports add column target_id uuid;
alter table private.reports add column target_type text check(target_type in ('review','post','comment'));
alter table private.reports add column status text not null default 'open' check(status in ('open','resolved','dismissed'));
update private.reports set target_id=review_id,target_type='review';
alter table private.reports alter column target_id set not null;
alter table private.reports alter column target_type set not null;
create unique index reports_target_idx on private.reports(reporter,target_id);
create table private.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid references private.companies(id),
  message text not null check(length(message) <= 300),
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on private.notifications(user_id,created_at desc);
create table private.brand_claims (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references private.companies(id),
  user_id uuid not null references auth.users(id),
  evidence text not null check(length(trim(evidence)) between 20 and 2000),
  status text not null default 'pending_review' check(status in ('pending_review','approved','rejected','revoked')),
  created_at timestamptz not null default now(),
  unique(company_id,user_id)
);
create unique index company_one_claim_idx on private.brand_claims(company_id) where status='approved';
create table private.brand_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references private.reviews(id),
  user_id uuid not null references auth.users(id),
  body text not null check(length(trim(body)) between 5 and 1200),
  visibility private.publication_state not null default 'pending_review',
  created_at timestamptz not null default now()
);
alter table private.moderation_actions add column before_state jsonb;
alter table private.moderation_actions add column after_state jsonb;
alter table private.review_proofs add column upload_state text not null default 'reserved' check(upload_state in ('reserved','uploaded','deleted'));
alter table private.review_proofs add column created_at timestamptz not null default now();
alter table private.review_proofs add column mime_type text check(mime_type in ('image/jpeg','image/png','image/webp'));
alter table private.review_proofs add column byte_size integer check(byte_size between 1 and 5242880);

-- Released rate cells are fixed, mutually exclusive cohorts. Filters select cells,
-- never rerun aggregates over arbitrary subsets. No exact extrema are released.
create table private.rate_cells (
  brand_id uuid not null references private.companies(id),
  category text not null,
  band text not null,
  deal_type text not null,
  deliverable text not null,
  creator_count integer not null check(creator_count>=5),
  median_inr numeric not null,
  members jsonb not null,
  published_at timestamptz not null default now(),
  primary key(brand_id,category,band,deal_type,deliverable)
);

do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname='private' loop
    execute format('alter table private.%I enable row level security',t.tablename);
    execute format('revoke all on private.%I from public, anon, authenticated',t.tablename);
  end loop;
end $$;
revoke all on all sequences in schema private from public, anon, authenticated;

create function private.require_moderator(admin_only boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); begin
  if not exists(select 1 from private.user_roles where user_id=u and (role='admin' or (not admin_only and role='moderator')))
    then raise exception 'Moderator access required.' using errcode='42501'; end if;
  return u;
end $$;

create function private.require_verified() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); begin
  if not exists(select 1 from private.instagram_verifications where user_id=u and expires_at>now())
    then raise exception 'Verify Instagram ownership before posting.' using errcode='42501'; end if;
  return u;
end $$;

create function private.identity_handle(input jsonb) returns text language plpgsql security definer set search_path='' as $$
declare mode text:=coalesce(input->>'identity_mode','anonymous'); h text; u uuid:=private.require_verified(); begin
  if mode not in ('anonymous','attributed') then raise exception 'Invalid identity mode.'; end if;
  if mode='anonymous' then return null; end if;
  if input->'attribution_consent' is distinct from 'true'::jsonb then raise exception 'Confirm public attribution before posting.'; end if;
  select handle into h from private.instagram_verifications where user_id=u and expires_at>now();
  return h;
end $$;

create function private.assert_input(input jsonb,allowed text[]) returns void language plpgsql set search_path='' as $$
begin
  if jsonb_typeof(input) is distinct from 'object' or (input-allowed)<>'{}'::jsonb then raise exception 'Invalid input fields.'; end if;
end $$;

create or replace function public.kollab_session() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; result jsonb; begin
  if auth.uid() is null then return null; end if;
  u:=private.require_user();
  select jsonb_build_object('id',p.user_id,'alias',p.alias,'follower_band',p.follower_band,'category',p.category,'city',p.city,
    'handle',coalesce(v.handle,''),'verified',coalesce(v.expires_at>now(),false),
    'role',coalesce((select role from private.user_roles where user_id=u),case when exists(select 1 from private.brand_claims where user_id=u and status='approved') then 'brand_rep' else 'creator' end),
    'contributions',(select count(*) from private.reviews where user_id=u and visibility='published'))
    into result from private.profiles p left join private.instagram_verifications v on v.user_id=p.user_id where p.user_id=u;
  return result;
end $$;

create or replace function public.kollab_update_profile(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); begin
  perform private.assert_input(input,array['alias','follower_band','category','city']);
  perform private.throttle('profile',20);
  if input->>'category' not in ('Beauty','Fashion','Tech','Food & drink','Lifestyle','Fitness','Agency','Other') then raise exception 'Choose a listed category.'; end if;
  update private.profiles set alias=trim(input->>'alias'),follower_band=input->>'follower_band',category=input->>'category',city=nullif(trim(input->>'city'),'') where user_id=u;
  return public.kollab_session();
end $$;

create function public.kollab_verification(input jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); c private.verification_challenges; h text; a text:=coalesce(input->>'action','status'); begin
  perform private.assert_input(input,array['action','handle','challenge_id']);
  perform 1 from private.profiles where user_id=u for update;
  update private.verification_challenges set status='expired' where user_id=u and status in ('pending','submitted') and expires_at<=now();
  if a='start' then
    perform private.throttle('verification_start',3);
    h:=lower(trim(leading '@' from trim(input->>'handle')));
    if h is null or h !~ '^[a-z0-9._]{1,30}$' then raise exception 'Enter a valid Instagram username.'; end if;
    -- Do not disclose whether another account has verified this handle.
    update private.verification_challenges set status='expired' where user_id=u and status in ('pending','submitted');
    insert into private.verification_challenges(user_id,handle) values(u,h) returning * into c;
  elsif a='submit' then
    perform private.throttle('verification_submit',10);
    update private.verification_challenges set status='submitted',submitted_at=now()
      where id=(input->>'challenge_id')::uuid and user_id=u and status='pending' and expires_at>now() returning * into c;
    if not found then raise exception 'Challenge unavailable or expired.'; end if;
  elsif a='status' then
    select * into c from private.verification_challenges where user_id=u order by created_at desc,id desc limit 1;
  else raise exception 'Unknown verification action.'; end if;
  if c.id is null then return null; end if;
  return jsonb_build_object('id',c.id,'handle',c.handle,'code',c.code,'status',c.status,'expires_at',c.expires_at,'submitted_at',c.submitted_at);
end $$;

create or replace function private.company_json(c private.companies) returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('id',c.id,'name',c.name,'slug',c.slug,'instagram_handle',c.instagram_handle,'category',c.category,
    'entity_type',c.entity_type,'website',c.website,'logo_url',c.logo_url,'hq_city',c.hq_city,'status',c.status,
    'is_claimed',exists(select 1 from private.brand_claims where company_id=c.id and status='approved'),
    'merged_into_id',c.merged_into_id,'demo',false,'color','#e4e8f4','created_at',null,
    'review_count',(select count(*) from private.reviews r where (r.brand_id=c.id or r.agency_id=c.id) and r.visibility='published'));
$$;

create or replace function private.review_json(r private.reviews) returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('id',r.id,'brand_id',r.brand_id,'agency_id',r.agency_id,'collab_month',to_char(r.collab_month,'YYYY-MM'),
    'identity_mode',r.identity_mode,'attribution_handle',case when r.identity_mode='attributed' then r.attribution_handle end,
    'alias',case when r.identity_mode='attributed' then '@'||r.attribution_handle else 'Creator '||upper(left(r.id::text,6)) end,
    'follower_band',r.follower_band,'category',r.category,'region',null,'deal_type',r.deal_type,
    'cash_amount_inr',r.cash_amount_inr,'final_amount_inr',r.final_amount_inr,'initial_offer_inr',r.initial_offer_inr,
    'product_claimed_value_inr',r.product_claimed_value_inr,'product_actual_value_inr',r.product_actual_value_inr,
    'deliverables',r.deliverables,'payment_status',r.payment_status,'days_to_payment',r.days_to_payment,
    'ghost_stage',r.ghost_stage,'usage_rights_requested',r.usage_rights_requested,'usage_rights_paid_separately',r.usage_rights_paid_separately,
    'ran_as_paid_ad_without_payment',r.ran_as_paid_ad_without_payment,'revisions_requested',r.revisions_requested,
    'scope_creep',r.scope_creep,'had_written_agreement',r.had_written_agreement,'rating_communication',r.rating_communication,
    'rating_professionalism',r.rating_professionalism,'rating_payment',r.rating_payment,'would_work_again',r.would_work_again,
    'body',r.body,'visibility',r.visibility,'proof_status',r.proof_status,
    'helpful_count',(select count(*) from private.votes where target_id=r.id),
    'reply',(select body from private.brand_replies br where br.review_id=r.id and br.visibility='published'
      and exists(select 1 from private.brand_claims bc where bc.company_id=r.brand_id and bc.user_id=br.user_id and bc.status='approved')),
    'brand',(select private.company_json(c) from private.companies c where c.id=r.brand_id),'demo',false);
$$;

create or replace function public.kollab_list_reviews(brand uuid default null, filters jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare allowance integer:=1; begin
  perform private.assert_input(filters,array['band','category','deal_type','year','q']);
  if auth.uid() is not null then
    perform private.require_user(); allowance:=3;
    if exists(select 1 from private.reviews where user_id=auth.uid() and visibility='published') then allowance:=200; end if;
  end if;
  -- Entitlement is global and deterministic, BEFORE brand and text filters.
  -- A caller cannot recover another set of locked reviews by varying filters.
  return (select coalesce(jsonb_agg(private.review_json(r)),'[]'::jsonb) from (
    select chosen.* from (
      select r.* from private.reviews r join private.companies c on c.id=r.brand_id
      where r.visibility='published' and c.status='active'
      order by r.id limit allowance
    ) chosen
    where (brand is null or chosen.brand_id=brand or chosen.agency_id=brand)
      and (nullif(filters->>'band','') is null or chosen.follower_band=filters->>'band')
      and (nullif(filters->>'category','') is null or chosen.category=filters->>'category')
      and (nullif(filters->>'deal_type','') is null or chosen.deal_type=filters->>'deal_type')
      and (nullif(filters->>'year','') is null or to_char(chosen.collab_month,'YYYY')=filters->>'year')
      and (nullif(filters->>'q','') is null or to_tsvector('english',coalesce(chosen.body,'')||' '||chosen.category||' '||replace(chosen.payment_status,'_',' ')||' '||replace(chosen.deal_type,'_',' ')||' '||case when chosen.ghost_stage<>'none' then 'ghosted ghosting' else '' end||' '||case when chosen.usage_rights_requested then 'usage rights' else '' end||' '||coalesce((select name||' '||instagram_handle from private.companies where id=chosen.brand_id),'')) @@ plainto_tsquery('english',left(filters->>'q',120)))
  ) r);
end $$;

create function private.comment_json(c private.comments) returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('id',c.id,'body',c.body,'identity_mode',c.identity_mode,'attribution_handle',c.attribution_handle,
    'alias',case when c.identity_mode='attributed' then '@'||c.attribution_handle else 'Creator '||upper(left(c.id::text,6)) end,
    'visibility',c.visibility);
$$;
create function private.post_json(p private.posts) returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('id',p.id,'category',p.category,'body',p.body,'identity_mode',p.identity_mode,'attribution_handle',p.attribution_handle,
    'alias',case when p.identity_mode='attributed' then '@'||p.attribution_handle else 'Creator '||upper(left(p.id::text,6)) end,
    'visibility',p.visibility,'helpful_count',(select count(*) from private.votes where target_id=p.id),
    'created_at',to_char(p.created_at,'YYYY-MM-DD'),
    'comments',(select coalesce(jsonb_agg(private.comment_json(c) order by c.created_at),'[]'::jsonb)
      from (select * from private.comments where post_id=p.id and visibility='published' order by created_at limit 100) c));
$$;

create function public.kollab_list_posts(category text default '', query text default '') returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(private.post_json(p)),'[]'::jsonb) from (
    select * from private.posts where visibility='published' and (kollab_list_posts.category='' or posts.category=kollab_list_posts.category)
      and (query='' or to_tsvector('english',body) @@ plainto_tsquery('english',left(query,120))
        or exists(select 1 from private.comments c where c.post_id=posts.id and c.visibility='published' and to_tsvector('english',c.body) @@ plainto_tsquery('english',left(query,120)))) order by created_at desc,id limit 100
  ) p;
$$;

create function public.kollab_create_post(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_verified(); h text; p private.posts; begin
  perform private.assert_input(input,array['category','body','identity_mode','attribution_consent']);
  perform private.throttle('post',5); h:=private.identity_handle(input);
  insert into private.posts(user_id,category,body,identity_mode,attribution_handle,attribution_consent_at)
    values(u,input->>'category',trim(input->>'body'),coalesce(input->>'identity_mode','anonymous')::private.identity_mode,h,case when h is not null then now() end) returning * into p;
  return private.post_json(p);
end $$;

create function public.kollab_comment(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_verified(); h text; c private.comments; begin
  perform private.assert_input(input,array['post_id','body','identity_mode','attribution_consent']);
  perform private.throttle('comment',20); h:=private.identity_handle(input);
  if not exists(select 1 from private.posts where id=(input->>'post_id')::uuid and visibility='published') then raise exception 'Post unavailable.'; end if;
  insert into private.comments(user_id,post_id,body,identity_mode,attribution_handle,attribution_consent_at)
    values(u,(input->>'post_id')::uuid,trim(input->>'body'),coalesce(input->>'identity_mode','anonymous')::private.identity_mode,h,case when h is not null then now() end) returning * into c;
  return private.comment_json(c);
end $$;

create function public.kollab_vote(target uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); owner uuid; begin
  perform private.throttle('vote',60);
  select user_id into owner from private.reviews where id=target and visibility='published';
  if owner is null then select user_id into owner from private.posts where id=target and visibility='published'; end if;
  if owner is null then select c.user_id into owner from private.comments c join private.posts p on p.id=c.post_id where c.id=target and c.visibility='published' and p.visibility='published'; end if;
  if owner is null or owner=u then raise exception 'This item cannot be voted on.'; end if;
  perform 1 from private.profiles where user_id=u for update;
  delete from private.votes where user_id=u and target_id=target;
  if found then return false; end if;
  insert into private.votes values(u,target); return true;
end $$;

create function public.kollab_report_target(target uuid, reason text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); kind text; begin
  perform private.throttle('report',10);
  if exists(select 1 from private.reviews where id=target and visibility='published') then kind:='review';
  elsif exists(select 1 from private.posts where id=target and visibility='published') then kind:='post';
  elsif exists(select 1 from private.comments where id=target and visibility='published') then kind:='comment';
  else raise exception 'Content unavailable.'; end if;
  insert into private.reports(reporter,target_id,target_type,reason) values(u,target,kind,trim(reason)) on conflict(reporter,target_id) do nothing;
end $$;
create or replace function public.kollab_report(review uuid, reason text) returns void language sql security definer set search_path='' as $$
  select public.kollab_report_target(review,reason);
$$;

create function public.kollab_notifications(mark_read boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  u:=private.require_user();
  if mark_read then update private.notifications set read=true where user_id=u and not read; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'brand_id',n.brand_id,'message',n.message,'read',n.read)),'[]'::jsonb)
    from (select * from private.notifications where user_id=u order by created_at desc limit 100) n);
end $$;

create function public.kollab_claim_brand(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); c private.brand_claims; begin
  perform private.assert_input(input,array['company_id','evidence']); perform private.throttle('claim',2);
  if not exists(select 1 from private.companies where id=(input->>'company_id')::uuid and status='active') then raise exception 'Company unavailable.'; end if;
  insert into private.brand_claims(company_id,user_id,evidence) values((input->>'company_id')::uuid,u,trim(input->>'evidence')) returning * into c;
  return jsonb_build_object('id',c.id,'company_id',c.company_id,'status',c.status);
end $$;
create function public.kollab_reply(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); r private.brand_replies; begin
  perform private.assert_input(input,array['review_id','body']); perform private.throttle('reply',10);
  if not exists(select 1 from private.reviews rv join private.brand_claims c on c.company_id=rv.brand_id
    where rv.id=(input->>'review_id')::uuid and rv.visibility='published' and c.user_id=u and c.status='approved')
    then raise exception 'Verified company representation required.' using errcode='42501'; end if;
  insert into private.brand_replies(review_id,user_id,body) values((input->>'review_id')::uuid,u,trim(input->>'body')) returning * into r;
  return jsonb_build_object('id',r.id,'review_id',r.review_id,'body',r.body,'visibility',r.visibility);
end $$;

create function private.refresh_rates() returns integer language plpgsql security definer set search_path='' as $$
declare c record; old private.rate_cells; changed integer; n integer:=0; begin
  -- Review edits/removals invalidate affected snapshots rather than retaining stale
  -- personal contributions. A cell is refreshed only after 5 distinct contributors
  -- change; this is not differential privacy and outside knowledge can still infer facts.
  delete from private.rate_cells rc where exists(select 1 from jsonb_each_text(rc.members) m
    where not exists(select 1 from private.reviews r join private.companies b on b.id=r.brand_id
      where r.user_id::text=m.key and r.id::text=m.value and r.visibility='published' and b.status='active'));
  for c in with latest as (
    select distinct on (r.user_id,r.brand_id) r.*,
      case when (r.deliverables->>'reels')::int>0 then 'reels' when (r.deliverables->>'stories')::int>0 then 'stories'
        when (r.deliverables->>'static_posts')::int>0 then 'static_posts' when (r.deliverables->>'ugc_raw')::int>0 then 'ugc_raw' else 'event_attendance' end main_deliverable
    from private.reviews r join private.companies b on b.id=r.brand_id
    where r.visibility='published' and b.status='active' and r.deal_type in ('paid','paid_plus_product')
      and not exists(select 1 from private.profiles p where p.user_id=r.user_id and p.banned_at is not null)
    order by r.user_id,r.brand_id,r.collab_month desc,r.id
  ) select brand_id,category,follower_band band,deal_type,main_deliverable deliverable,count(*)::int n,
      round((percentile_cont(0.5) within group(order by final_amount_inr))::numeric/1000)*1000 median,
      jsonb_object_agg(user_id::text,id::text) members from latest
    group by brand_id,category,follower_band,deal_type,main_deliverable having count(*)>=5
  loop
    select * into old from private.rate_cells where brand_id=c.brand_id and category=c.category and band=c.band and deal_type=c.deal_type and deliverable=c.deliverable;
    if old.brand_id is not null then
      select count(*) into changed from (select key,value from jsonb_each(c.members) except select key,value from jsonb_each(old.members)) changes;
      if changed<5 or old.published_at>now()-interval '1 day' then continue; end if;
    end if;
    insert into private.rate_cells(brand_id,category,band,deal_type,deliverable,creator_count,median_inr,members)
      values(c.brand_id,c.category,c.band,c.deal_type,c.deliverable,(c.n/5)*5,c.median,c.members)
      on conflict(brand_id,category,band,deal_type,deliverable) do update set creator_count=excluded.creator_count,
        median_inr=excluded.median_inr,members=excluded.members,published_at=now();
    n:=n+1;
  end loop;
  return n;
end $$;

create function public.kollab_rates(filters jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); begin
  perform private.assert_input(filters,array['q','category','band','deal_type','city','deliverable','brand_id']);
  if not exists(select 1 from private.reviews where user_id=u and visibility='published') then return '[]'::jsonb; end if;
  if nullif(filters->>'city','') is not null then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('category',c.category,'band',c.band,'deal_type',c.deal_type,'deliverable',c.deliverable,
    'brand_id',c.brand_id,'brand_name',b.name,'count',c.creator_count,'median',c.median_inr,'min',null,'max',null,'snapshot_date',to_char(c.published_at,'YYYY-MM-DD'))),'[]'::jsonb)
    from private.rate_cells c join private.companies b on b.id=c.brand_id where b.status='active'
      and (nullif(filters->>'category','') is null or c.category=filters->>'category')
      and (nullif(filters->>'band','') is null or c.band=filters->>'band')
      and (nullif(filters->>'deal_type','') is null or c.deal_type=filters->>'deal_type')
      and (nullif(filters->>'deliverable','') is null or c.deliverable=filters->>'deliverable')
      and (nullif(filters->>'brand_id','') is null or c.brand_id::text=filters->>'brand_id')
      and (nullif(filters->>'q','') is null or to_tsvector('simple',b.name||' '||b.instagram_handle||' '||c.category||' '||replace(c.deliverable,'_',' ')) @@ plainto_tsquery('simple',left(filters->>'q',120))));
end $$;

-- Explicit RPC grants are finalized in the lifecycle migration.
revoke all on all functions in schema private from public,anon,authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'kollab\_%' escape '\' loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  end loop;
end $$;
grant execute on function public.kollab_session(),public.kollab_search_brands(text,integer,text),public.kollab_list_reviews(uuid,jsonb),
  public.kollab_aggregates(uuid),public.kollab_watchlist(uuid),public.kollab_list_posts(text,text),public.kollab_notifications(boolean) to anon,authenticated;
grant execute on function public.kollab_create_brand(jsonb),public.kollab_update_profile(jsonb),public.kollab_create_review(jsonb),
  public.kollab_report(uuid,text),public.kollab_verification(jsonb),public.kollab_create_post(jsonb),public.kollab_comment(jsonb),
  public.kollab_vote(uuid),public.kollab_report_target(uuid,text),public.kollab_claim_brand(jsonb),public.kollab_reply(jsonb),public.kollab_rates(jsonb) to authenticated;
commit;
