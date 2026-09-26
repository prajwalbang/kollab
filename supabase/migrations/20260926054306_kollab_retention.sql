-- Service-role only maintenance. Deploy the worker separately from the web app.
begin;
create function public.kollab_expired_proofs() returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'path',p.storage_path)),'[]'::jsonb)
  from (select id,storage_path from private.review_proofs where delete_after<=now() and upload_state<>'deleted' order by delete_after,id limit 100) p;
$$;
create function public.kollab_expired_proofs_deleted(proof_ids uuid[]) returns void language plpgsql security definer set search_path='' as $$
begin
  if cardinality(proof_ids)>100 then raise exception 'Batch too large.'; end if;
  with changed as (
    update private.review_proofs set upload_state='deleted' where id=any(proof_ids) and delete_after<=now() and upload_state<>'deleted' returning id
  ) insert into private.moderation_actions(actor,target_id,action,reason)
    select 'retention-worker',id,'proof:delete','Expired object deleted through Storage API.' from changed;
end $$;
revoke all on function public.kollab_expired_proofs(),public.kollab_expired_proofs_deleted(uuid[]) from public,anon,authenticated;
grant execute on function public.kollab_expired_proofs(),public.kollab_expired_proofs_deleted(uuid[]) to service_role;
commit;
