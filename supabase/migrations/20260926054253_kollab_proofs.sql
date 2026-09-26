-- Private, image-only evidence. Storage RLS is also necessary: same-origin routes
-- alone cannot protect the Data API. Supabase Storage schema must already exist.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('review-proofs','review-proofs',false,5242880,array['image/jpeg','image/png','image/webp'])
  on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create function public.kollab_proof_reserve(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); p private.review_proofs; rid uuid:=(input->>'review_id')::uuid; ext text; begin
  perform private.assert_input(input,array['review_id','proof_type','mime_type','byte_size']);
  perform private.throttle('proof',10);
  perform 1 from private.reviews where id=rid and user_id=u and visibility<>'removed' for update;
  if not found then raise exception 'Review unavailable.' using errcode='42501'; end if;
  if (select count(*) from private.review_proofs where review_id=rid and upload_state<>'deleted')>=3 then raise exception 'Maximum three proofs per review.'; end if;
  ext:=case input->>'mime_type' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' end;
  if ext is null then raise exception 'Only JPEG, PNG and WebP images are accepted.'; end if;
  insert into private.review_proofs(review_id,storage_path,proof_type,delete_after,mime_type,byte_size)
    values(rid,replace(gen_random_uuid()::text,'-','')||'/'||replace(gen_random_uuid()::text,'-','')||'.'||ext,
      input->>'proof_type',now()+interval '30 days',input->>'mime_type',(input->>'byte_size')::integer) returning * into p;
  return jsonb_build_object('id',p.id,'path',p.storage_path,'bucket','review-proofs');
end $$;

create function public.kollab_proof_finalize(proof uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); p private.review_proofs; meta jsonb; begin
  select p1.* into p from private.review_proofs p1 join private.reviews r on r.id=p1.review_id
    where p1.id=proof and r.user_id=u and r.visibility<>'removed' and p1.upload_state='reserved' and p1.created_at>now()-interval '1 hour' for update of p1;
  if p.id is null then raise exception 'Proof unavailable.' using errcode='42501'; end if;
  select metadata into meta from storage.objects where bucket_id='review-proofs' and name=p.storage_path;
  if meta is null or meta->>'mimetype' is distinct from p.mime_type or coalesce((meta->>'size')::bigint,0) not between 1 and 5242880
    then raise exception 'Upload missing or invalid.'; end if;
  update private.review_proofs set upload_state='uploaded' where id=p.id;
  update private.reviews set proof_status=case when proof_status='verified' then 'verified' else 'pending' end where id=p.review_id;
  return jsonb_build_object('id',p.id,'status','uploaded');
end $$;

create function public.kollab_proof_access(proof uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_moderator(); p private.review_proofs; begin
  perform private.throttle('proof_read',100);
  select * into p from private.review_proofs where id=proof and upload_state='uploaded' and delete_after>now();
  if p.id is null then raise exception 'Proof unavailable.'; end if;
  insert into private.moderation_actions(actor,target_id,action,reason) values(u::text,p.id,'proof:read','Moderator opened private evidence.');
  return jsonb_build_object('id',p.id,'path',p.storage_path,'bucket','review-proofs','mime_type',p.mime_type);
end $$;

-- Policy helpers live in public because the storage roles cannot use private.
-- They return booleans only and never disclose paths or identities to callers.
create function public.kollab_storage_can_insert(path text) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.review_proofs p join private.reviews r on r.id=p.review_id
    join auth.users a on a.id=r.user_id join private.profiles pr on pr.user_id=r.user_id
    where p.storage_path=path and r.user_id=auth.uid() and a.email_confirmed_at is not null and pr.banned_at is null
      and r.visibility<>'removed' and p.upload_state='reserved' and p.created_at>now()-interval '1 hour');
$$;
create function public.kollab_storage_can_read(path text) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.user_roles ur join private.profiles pr on pr.user_id=ur.user_id
    join auth.users a on a.id=ur.user_id where ur.user_id=auth.uid() and pr.banned_at is null and a.email_confirmed_at is not null)
    and exists(select 1 from private.review_proofs p where p.storage_path=path and p.upload_state='uploaded' and p.delete_after>now()
      and exists(select 1 from private.moderation_actions ma where ma.actor=auth.uid()::text and ma.target_id=p.id and ma.action='proof:read' and ma.created_at>now()-interval '1 minute'));
$$;
create policy kollab_proofs_insert on storage.objects for insert to authenticated
  with check(bucket_id='review-proofs' and public.kollab_storage_can_insert(name));
create policy kollab_proofs_read on storage.objects for select to authenticated
  using(bucket_id='review-proofs' and public.kollab_storage_can_read(name));
-- No UPDATE or DELETE policies: uploads are immutable. Retention cleanup uses an
-- operator's Storage delete API (never DELETE storage.objects directly).
revoke all on function public.kollab_proof_reserve(jsonb),public.kollab_proof_finalize(uuid),public.kollab_proof_access(uuid),
  public.kollab_storage_can_insert(text),public.kollab_storage_can_read(text) from public,anon,authenticated;
grant execute on function public.kollab_proof_reserve(jsonb),public.kollab_proof_finalize(uuid),public.kollab_proof_access(uuid),
  public.kollab_storage_can_insert(text),public.kollab_storage_can_read(text) to authenticated;
commit;
