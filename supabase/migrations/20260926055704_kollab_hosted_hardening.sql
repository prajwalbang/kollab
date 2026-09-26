begin;
-- Dashboard-installed event trigger: clients never need to invoke it directly.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
  end if;
end $$;
create index brand_claims_user_idx on private.brand_claims(user_id);
create index brand_replies_user_idx on private.brand_replies(user_id);
create index comments_user_idx on private.comments(user_id);
create index companies_creator_idx on private.companies(created_by);
create index companies_merge_idx on private.companies(merged_into_id);
create index instagram_verifier_idx on private.instagram_verifications(verified_by);
create index notifications_brand_idx on private.notifications(brand_id);
create index posts_user_idx on private.posts(user_id);
create index reports_review_idx on private.reports(review_id);
create index review_proofs_review_idx on private.review_proofs(review_id);
create index review_proofs_reviewer_idx on private.review_proofs(reviewed_by);
create index watchlist_brand_idx on private.watchlist(brand_id);
commit;
