begin;
-- An approved representative can read published reviews of their own company
-- without contributing a creator review. Same anonymous projection, no identities.
create function public.kollab_representative_reviews(company uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); begin
  if not exists(select 1 from private.brand_claims where company_id=company and user_id=u and status='approved') then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(private.review_json(r)),'[]'::jsonb) from (
    select r.* from private.reviews r join private.companies c on c.id=r.brand_id
      where r.brand_id=company and r.visibility='published' and c.status='active' order by r.created_at desc,r.id limit 100
  ) r);
end $$;
revoke all on function public.kollab_representative_reviews(uuid) from public,anon,authenticated;
grant execute on function public.kollab_representative_reviews(uuid) to authenticated;
commit;
