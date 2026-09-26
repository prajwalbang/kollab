-- Operator-run permission smoke test. All synthetic data is rolled back.
-- Tests PostgreSQL role boundaries, not email delivery or real Auth JWT issuance.
begin;
select set_config('kollab.test_user',gen_random_uuid()::text,true);
select set_config('kollab.test_other',gen_random_uuid()::text,true);
insert into auth.users(id,email_confirmed_at) values
  (current_setting('kollab.test_user')::uuid,now()),
  (current_setting('kollab.test_other')::uuid,now());
select set_config('request.jwt.claim.sub',current_setting('kollab.test_user'),true);
set local role authenticated;
do $$ declare s jsonb; v jsonb; denied boolean:=false; begin
  s:=public.kollab_session();
  assert s->>'id'=current_setting('kollab.test_user');
  assert s->>'verified'='false';
  begin perform public.kollab_admin_queue(); exception when insufficient_privilege then denied:=true; end;
  assert denied,'Regular account must not access moderation';
  denied:=false;
  begin perform 1 from private.instagram_verifications; exception when insufficient_privilege then denied:=true; end;
  assert denied,'Private verification table must not be readable';
  denied:=false;
  begin perform public.kollab_create_post('{"category":"Beauty","body":"Synthetic smoke test question"}'); exception when insufficient_privilege then denied:=true; end;
  assert denied,'Unverified account must not post';
  v:=public.kollab_verification(jsonb_build_object('action','start','handle','kollab_smoke_test'));
  perform set_config('kollab.test_challenge',v->>'id',true);
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('kollab.test_other'),true);
set local role authenticated;
do $$ declare denied boolean:=false; begin
  perform public.kollab_session();
  assert public.kollab_verification() is null,'Other account must not see the first account challenge';
  begin
    perform public.kollab_verification(jsonb_build_object('action','submit','challenge_id',current_setting('kollab.test_challenge')));
  exception when raise_exception then denied:=true; end;
  assert denied,'Other account must not submit the first account challenge';
end $$;
reset role;
insert into private.instagram_verifications(user_id,handle,method)
  values(current_setting('kollab.test_user')::uuid,'kollab_smoke_test','manual_bio');
insert into private.user_roles(user_id,role) values(current_setting('kollab.test_other')::uuid,'moderator');
select set_config('request.jwt.claim.sub',current_setting('kollab.test_user'),true);
set local role authenticated;
do $$ declare p jsonb; denied boolean:=false; begin
  assert public.kollab_session()->>'verified'='true';
  p:=public.kollab_create_post('{"category":"Beauty","body":"Synthetic smoke test question","identity_mode":"anonymous"}');
  assert p->>'visibility'='pending_review';
  assert p->>'attribution_handle' is null;
  assert not p ? 'user_id';
  perform set_config('kollab.test_post',p->>'id',true);
  begin perform public.kollab_create_post('{"category":"Beauty","body":"Synthetic attribution test","identity_mode":"attributed","attribution_consent":false}'); exception when raise_exception then denied:=true; end;
  assert denied,'Attribution requires explicit consent';
  p:=public.kollab_create_post('{"category":"Beauty","body":"Synthetic attribution test","identity_mode":"attributed","attribution_consent":true}');
  assert p->>'attribution_handle'='kollab_smoke_test';
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('kollab.test_other'),true);
set local role authenticated;
do $$ begin
  perform public.kollab_admin_action(jsonb_build_object('action','post','target_id',current_setting('kollab.test_post'),'decision','published','reason','Synthetic smoke test, rolled back'));
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
  assert exists(select 1 from jsonb_array_elements(public.kollab_list_posts()) p where p->>'id'=current_setting('kollab.test_post'));
end $$;
reset role;
rollback;
select 'passed; synthetic users and content rolled back' as hosted_permission_check;
