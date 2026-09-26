-- Apply as the Supabase project database owner. Private tables are not Data API resources.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
alter default privileges in schema private revoke all on tables from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

create type private.identity_mode as enum ('anonymous', 'attributed');
create type private.publication_state as enum ('pending_review', 'published', 'removed');
create type private.company_state as enum ('pending_review', 'active', 'hidden', 'merged');

create table private.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  alias text not null default 'Quiet Creator' check (length(alias) between 2 and 40),
  follower_band text not null default 'under_1k' check (follower_band in ('under_1k','1k_5k','5k_10k','10k_25k','25k_50k','50k_100k','over_100k')),
  category text not null default 'Other' check (length(category) between 1 and 60),
  city text check (length(city) <= 80),
  banned_at timestamptz,
  created_at timestamptz not null default now()
);

-- No client grants. Verification may only be recorded by a trusted operator.
-- Handles are needed for opt-in attribution; this schema has no Data API exposure.
-- No OAuth access token, exact follower count or raw profile response is stored.
create table private.instagram_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  instagram_subject text unique,
  handle text not null unique check (handle ~ '^[a-z0-9._]{1,30}$'),
  method text not null check (method in ('manual_bio', 'instagram_oauth')),
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  verified_by uuid references auth.users(id),
  check (expires_at > verified_at)
);

create table private.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  normalized_name text generated always as (regexp_replace(lower(name), '[^a-z0-9]', '', 'g')) stored,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,159}$'),
  instagram_handle text not null unique check (instagram_handle ~ '^[a-z0-9._]{1,30}$'),
  category text not null check (length(category) between 1 and 60),
  entity_type text not null check (entity_type in ('brand','agency')),
  website text check (length(website) <= 2048 and website ~ '^https://[^[:space:]]+$'),
  logo_url text check (length(logo_url) <= 2048 and logo_url ~ '^https://[^[:space:]]+$'),
  hq_city text check (length(hq_city) <= 80),
  status private.company_state not null default 'pending_review',
  merged_into_id uuid references private.companies(id),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((status = 'merged') = (merged_into_id is not null)),
  check (merged_into_id is distinct from id)
);
create index company_normalized_name_idx on private.companies(normalized_name text_pattern_ops);
create unique index company_normalized_name_unique on private.companies(normalized_name) where normalized_name<>'';
create index company_search_idx on private.companies using gin (to_tsvector('simple', name || ' ' || instagram_handle || ' ' || category));
create table private.company_aliases (
  company_id uuid not null references private.companies(id) on delete cascade,
  alias text not null check (length(alias) between 2 and 120),
  primary key (company_id, alias)
);

create table private.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  brand_id uuid not null references private.companies(id),
  agency_id uuid references private.companies(id),
  collab_month date not null check (extract(day from collab_month) = 1),
  identity_mode private.identity_mode not null default 'anonymous',
  attribution_handle text,
  attribution_consent_at timestamptz,
  follower_band text not null,
  category text not null,
  deal_type text not null check (deal_type in ('barter','paid','paid_plus_product','affiliate_only','exposure_only')),
  cash_amount_inr numeric(12,2) not null check (cash_amount_inr between 0 and 100000000),
  product_claimed_value_inr numeric(12,2) check (product_claimed_value_inr between 0 and 100000000),
  product_actual_value_inr numeric(12,2) check (product_actual_value_inr between 0 and 100000000),
  initial_offer_inr numeric(12,2) check (initial_offer_inr between 0 and 100000000),
  final_amount_inr numeric(12,2) not null check (final_amount_inr between 0 and 100000000),
  deliverables jsonb not null,
  payment_status text not null check (payment_status in ('paid_on_time','paid_late','partially_paid','never_paid','not_applicable')),
  days_to_payment integer check (days_to_payment between 0 and 3650),
  ghost_stage text not null check (ghost_stage in ('none','before_agreement','after_agreement','after_content_sent','after_posting','during_payment')),
  usage_rights_requested boolean not null,
  usage_rights_paid_separately boolean not null,
  ran_as_paid_ad_without_payment boolean not null,
  revisions_requested integer not null check (revisions_requested between 0 and 1000),
  scope_creep boolean not null,
  had_written_agreement boolean not null,
  rating_communication integer not null check (rating_communication between 1 and 5),
  rating_professionalism integer not null check (rating_professionalism between 1 and 5),
  rating_payment integer not null check (rating_payment between 1 and 5),
  would_work_again boolean not null,
  body text check (length(body) <= 1200),
  visibility private.publication_state not null default 'pending_review',
  proof_status text not null default 'none' check (proof_status in ('none','pending','verified','rejected')),
  trust_score numeric not null default 0.5 check (trust_score > 0 and trust_score <= 1),
  created_at timestamptz not null default now(),
  unique (user_id, brand_id, collab_month),
  check (brand_id is distinct from agency_id),
  check ((identity_mode = 'anonymous' and attribution_handle is null and attribution_consent_at is null)
    or (identity_mode = 'attributed' and attribution_handle ~ '^[a-z0-9._]{1,30}$' and attribution_consent_at is not null))
);
create index reviews_brand_visibility_idx on private.reviews(brand_id, visibility);
create index reviews_agency_idx on private.reviews(agency_id, visibility);
create index reviews_search_idx on private.reviews using gin (to_tsvector('english', coalesce(body, '')));

create table private.watchlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null references private.companies(id) on delete cascade,
  primary key (user_id, brand_id)
);
create table private.review_proofs (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references private.reviews(id),
  storage_path text not null unique,
  proof_type text not null check (proof_type in ('dm_screenshot','email','invoice','contract','bank_credit')),
  verdict text not null default 'pending' check (verdict in ('pending','verified','rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  delete_after timestamptz not null
);
create table private.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references auth.users(id),
  review_id uuid not null references private.reviews(id),
  reason text not null check (length(reason) between 1 and 500),
  created_at timestamptz not null default now(),
  unique(reporter, review_id)
);
create table private.moderation_actions (
  id bigint generated always as identity primary key,
  actor text not null,
  target_id uuid not null,
  action text not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create table private.request_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  count integer not null,
  primary key(user_id, action, window_start)
);

-- RLS plus zero client grants: access happens only through the bounded RPCs below.
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname = 'private' loop
    execute format('alter table private.%I enable row level security', t.tablename);
    execute format('revoke all on private.%I from public, anon, authenticated', t.tablename);
  end loop;
end $$;

create function private.require_user() returns uuid language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); begin
  if u is null or not exists(select 1 from auth.users where id=u and email_confirmed_at is not null)
    then raise exception 'Sign in with a confirmed email.' using errcode='42501'; end if;
  if exists(select 1 from private.profiles where user_id=u and banned_at is not null)
    then raise exception 'Account unavailable.' using errcode='42501'; end if;
  insert into private.profiles(user_id) values(u) on conflict do nothing;
  return u;
end $$;

create function private.throttle(a text, maximum integer) returns void language plpgsql security definer set search_path = '' as $$
declare n integer; u uuid := private.require_user(); begin
  insert into private.request_limits values(u,a,date_trunc('hour',now()),1)
    on conflict(user_id,action,window_start) do update set count=request_limits.count+1 returning count into n;
  if n > maximum then raise exception 'Too many requests. Try again later.' using errcode='P0001'; end if;
end $$;

create function public.kollab_session() returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid; result jsonb; begin
  if auth.uid() is null then return null; end if;
  u := private.require_user();
  select jsonb_build_object('id', p.user_id, 'alias',p.alias, 'follower_band',p.follower_band,
    'category',p.category,'city',p.city,'handle',coalesce(v.handle,''),
    'verified',v.expires_at > now(),
    'contributions',(select count(*) from private.reviews r where r.user_id=u and visibility='published'))
    into result from private.profiles p left join private.instagram_verifications v on v.user_id=p.user_id where p.user_id=u;
  return result;
end $$;

create function private.company_json(c private.companies) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id',c.id,'name',c.name,'slug',c.slug,'instagram_handle',c.instagram_handle,
    'category',c.category,'entity_type',c.entity_type,'website',c.website,'logo_url',c.logo_url,'hq_city',c.hq_city,
    'status',c.status,'is_claimed',false,'merged_into_id',c.merged_into_id,'demo',false,'color','#e4e8f4',
    'review_count',(select count(*) from private.reviews r where (r.brand_id=c.id or r.agency_id=c.id) and visibility='published'));
$$;

create function public.kollab_search_brands(query text default '', result_limit integer default 50, wanted_slug text default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(private.company_json(c)), '[]'::jsonb) from (
    select b.* from private.companies b
    where (b.status='active' or (b.status='pending_review' and b.created_by=auth.uid()))
      and (wanted_slug is null or b.slug=left(wanted_slug,160))
      and (left(query,120)='' or b.normalized_name like '%' || regexp_replace(lower(left(query,120)),'[^a-z0-9]','','g') || '%'
        or b.instagram_handle like '%' || regexp_replace(lower(left(query,120)),'[^a-z0-9._]','','g') || '%'
        or to_tsvector('simple',b.name || ' ' || b.instagram_handle || ' ' || b.category) @@ plainto_tsquery('simple',left(query,120))
        or exists(select 1 from private.company_aliases a where a.company_id=b.id and lower(a.alias)=lower(left(query,120))))
    order by (b.instagram_handle=trim(leading '@' from lower(left(query,120)))) desc, b.name,b.id
    limit greatest(1,least(result_limit,100))
  ) c;
$$;

create function public.kollab_create_brand(input jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare c private.companies; u uuid := private.require_user(); h text; n text; begin
  perform private.throttle('company',5);
  n := trim(input->>'name'); h := lower(trim(leading '@' from trim(input->>'instagram_handle')));
  if exists(select 1 from private.companies where instagram_handle=h or normalized_name=regexp_replace(lower(n),'[^a-z0-9]','','g'))
    then raise exception 'This company may already exist. Search before adding it.'; end if;
  insert into private.companies(name,slug,instagram_handle,category,entity_type,website,created_by)
    values(n, trim(both '-' from regexp_replace(lower(n),'[^a-z0-9]+','-','g')) || '-' || substr(gen_random_uuid()::text,1,8),
      h,input->>'category',input->>'entity_type',nullif(input->>'website',''),u) returning * into c;
  return private.company_json(c);
end $$;

create function public.kollab_update_profile(input jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_user(); begin
  perform private.throttle('profile',20);
  update private.profiles set alias=trim(input->>'alias'), follower_band=input->>'follower_band',category=input->>'category',city=nullif(trim(input->>'city'),'') where user_id=u;
  return public.kollab_session();
end $$;

-- Explicit projection: adding a private column cannot accidentally expose it.
create function private.review_json(r private.reviews) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id',r.id,'brand_id',r.brand_id,'agency_id',r.agency_id,'collab_month',to_char(r.collab_month,'YYYY-MM'),
    'identity_mode',r.identity_mode,'attribution_handle',case when r.identity_mode='attributed' then r.attribution_handle else null end,
    'follower_band',r.follower_band,'category',r.category,'region',null,'deal_type',r.deal_type,
    'cash_amount_inr',r.cash_amount_inr,'final_amount_inr',r.final_amount_inr,'initial_offer_inr',r.initial_offer_inr,
    'product_claimed_value_inr',r.product_claimed_value_inr,'product_actual_value_inr',r.product_actual_value_inr,
    'deliverables',r.deliverables,'payment_status',r.payment_status,'days_to_payment',r.days_to_payment,
    'ghost_stage',r.ghost_stage,'usage_rights_requested',r.usage_rights_requested,'usage_rights_paid_separately',r.usage_rights_paid_separately,
    'ran_as_paid_ad_without_payment',r.ran_as_paid_ad_without_payment,'revisions_requested',r.revisions_requested,
    'scope_creep',r.scope_creep,'had_written_agreement',r.had_written_agreement,'rating_communication',r.rating_communication,
    'rating_professionalism',r.rating_professionalism,'rating_payment',r.rating_payment,'would_work_again',r.would_work_again,
    'body',r.body,'visibility',r.visibility,'proof_status',r.proof_status,'helpful_count',0,'reply',null,'demo',false);
$$;

create function public.kollab_create_review(input jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_user(); p private.profiles; v private.instagram_verifications; r private.reviews;
  mode private.identity_mode := coalesce(input->>'identity_mode','anonymous')::private.identity_mode;
  k text; total integer := 0; val numeric;
begin
  perform private.throttle('review',5);
  if jsonb_typeof(input) is distinct from 'object' or input - array['brand_id','agency_id','collab_month','identity_mode','attribution_consent','deal_type','cash_amount_inr','product_claimed_value_inr','product_actual_value_inr','initial_offer_inr','final_amount_inr','deliverables','payment_status','days_to_payment','ghost_stage','usage_rights_requested','usage_rights_paid_separately','ran_as_paid_ad_without_payment','revisions_requested','scope_creep','had_written_agreement','rating_communication','rating_professionalism','rating_payment','would_work_again','body'] <> '{}'::jsonb then raise exception 'Invalid input fields.'; end if;
  -- Serialize concurrent submissions for this account (duplicate and rate-limit protection).
  select * into p from private.profiles where user_id=u for update;
  select * into v from private.instagram_verifications where user_id=u and expires_at > now();
  if v.user_id is null then raise exception 'Verify Instagram ownership before posting.' using errcode='42501'; end if;
  if mode='attributed' and coalesce((input->>'attribution_consent')::boolean,false) is not true
    then raise exception 'Confirm public attribution before posting.'; end if;
  if input->>'collab_month' is null or input->>'collab_month' !~ '^\d{4}-(0[1-9]|1[0-2])$' or input->>'collab_month' > to_char(now(),'YYYY-MM') or input->>'collab_month' < '2000-01'
    then raise exception 'Choose a valid completed collaboration month.'; end if;
  if jsonb_typeof(input->'deliverables') is distinct from 'object' then raise exception 'Deliverables required.'; end if;
  if (input->'deliverables') - array['reels','stories','static_posts','ugc_raw','event_attendance'] <> '{}'::jsonb then raise exception 'Invalid deliverable.'; end if;
  foreach k in array array['reels','stories','static_posts','ugc_raw','event_attendance'] loop
    val := (input->'deliverables'->>k)::numeric;
    if val is null or val < 0 or val > 1000 or trunc(val) <> val then raise exception 'Invalid deliverable quantity.'; end if;
    total := total + val::integer;
  end loop;
  if total=0 then raise exception 'At least one deliverable is required.'; end if;
  if not exists(select 1 from private.companies where id=(input->>'brand_id')::uuid and entity_type='brand'
    and (status='active' or (status='pending_review' and created_by=u))) then raise exception 'Brand unavailable.'; end if;
  if input->>'agency_id' is not null and not exists(select 1 from private.companies where id=(input->>'agency_id')::uuid
    and entity_type='agency' and (status='active' or (status='pending_review' and created_by=u))) then raise exception 'Agency unavailable.'; end if;
  insert into private.reviews(user_id,brand_id,agency_id,collab_month,identity_mode,attribution_handle,attribution_consent_at,
    follower_band,category,deal_type,cash_amount_inr,product_claimed_value_inr,product_actual_value_inr,initial_offer_inr,final_amount_inr,
    deliverables,payment_status,days_to_payment,ghost_stage,usage_rights_requested,usage_rights_paid_separately,ran_as_paid_ad_without_payment,
    revisions_requested,scope_creep,had_written_agreement,rating_communication,rating_professionalism,rating_payment,would_work_again,body)
  values(u,(input->>'brand_id')::uuid,(input->>'agency_id')::uuid,((input->>'collab_month') || '-01')::date,mode,
    case when mode='attributed' then v.handle end, case when mode='attributed' then now() end,p.follower_band,p.category,
    input->>'deal_type',(input->>'cash_amount_inr')::numeric,(input->>'product_claimed_value_inr')::numeric,
    (input->>'product_actual_value_inr')::numeric,(input->>'initial_offer_inr')::numeric,(input->>'final_amount_inr')::numeric,
    input->'deliverables',input->>'payment_status',(input->>'days_to_payment')::integer,input->>'ghost_stage',
    (input->>'usage_rights_requested')::boolean,(input->>'usage_rights_paid_separately')::boolean,(input->>'ran_as_paid_ad_without_payment')::boolean,
    (input->>'revisions_requested')::integer,(input->>'scope_creep')::boolean,(input->>'had_written_agreement')::boolean,
    (input->>'rating_communication')::integer,(input->>'rating_professionalism')::integer,(input->>'rating_payment')::integer,
    (input->>'would_work_again')::boolean,nullif(trim(input->>'body'),'')) returning * into r;
  return private.review_json(r);
end $$;

create function public.kollab_list_reviews(brand uuid default null, filters jsonb default '{}') returns jsonb language plpgsql security definer set search_path = '' as $$
declare allowance integer := 1; begin
  if auth.uid() is not null then
    perform private.require_user();
    allowance := 3;
    if exists(select 1 from private.reviews where user_id=auth.uid() and visibility='published') then allowance:=100; end if;
  end if;
  -- Select the entitled set BEFORE filters. Changing filters cannot enumerate locked reviews.
  return (select coalesce(jsonb_agg(private.review_json(r)),'[]'::jsonb) from (
    select chosen.* from (
      select r.* from private.reviews r join private.companies c on c.id=r.brand_id
      where r.visibility='published' and c.status='active' and (brand is null or r.brand_id=brand or r.agency_id=brand)
      order by r.id limit allowance
    ) chosen
    where (filters->>'band' is null or chosen.follower_band=filters->>'band')
      and (filters->>'category' is null or chosen.category=filters->>'category')
      and (filters->>'deal_type' is null or chosen.deal_type=filters->>'deal_type')
      and (filters->>'year' is null or to_char(chosen.collab_month,'YYYY')=filters->>'year')
  ) r);
end $$;

-- Minimum FIVE distinct creators, not five reviews from the same account.
-- Fixed brand cohort only: no arbitrary narrow filters or exposed min/max values.
create function public.kollab_aggregates(brand uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  with r as (select r.* from private.reviews r join private.companies c on c.id=r.brand_id
    where visibility='published' and c.status='active' and (r.brand_id=brand or r.agency_id=brand)),
  a as (select count(*) n,count(distinct user_id) people from r)
  select jsonb_build_object('count',a.n,
    'would_work_again',case when a.people>=5 then (select round(100*coalesce(sum(trust_score) filter(where would_work_again),0)/sum(trust_score)) from r) end,
    'ghost_rate',case when a.people>=5 then (select round(100*coalesce(sum(trust_score) filter(where ghost_stage<>'none'),0)/sum(trust_score)) from r) end,
    'on_time_rate',case when (select count(distinct user_id) from r where payment_status in ('paid_on_time','paid_late','partially_paid','never_paid'))>=5 then
      (select round(100*coalesce(sum(trust_score) filter(where payment_status='paid_on_time'),0)/sum(trust_score)) from r where payment_status<>'not_applicable') end,
    'median_cash',null,'median_days_to_payment',null,'product_claimed_value',null,'product_actual_value',null)
    from a;
$$;

create function public.kollab_watchlist(brand uuid default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid; begin
  if auth.uid() is null and brand is null then return '[]'::jsonb; end if;
  u:=private.require_user();
  if brand is not null then
    perform private.throttle('watchlist',100);
    if not exists(select 1 from private.companies where id=brand and (status='active' or created_by=u)) then raise exception 'Company unavailable.'; end if;
    -- Lock account so concurrent toggles cannot race.
    perform 1 from private.profiles where user_id=u for update;
    delete from private.watchlist where user_id=u and brand_id=brand;
    if found then return 'false'::jsonb; end if;
    insert into private.watchlist values(u,brand); return 'true'::jsonb;
  end if;
  return (select coalesce(jsonb_agg(private.company_json(c)),'[]'::jsonb) from private.companies c
    join private.watchlist w on w.brand_id=c.id where w.user_id=u and (c.status='active' or c.created_by=u));
end $$;

create function public.kollab_report(review uuid, reason text) returns void language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_user(); begin
  perform private.throttle('report',10);
  if not exists(select 1 from private.reviews where id=review and visibility='published') then raise exception 'Review unavailable.'; end if;
  insert into private.reports(reporter,review_id,reason) values(u,review,reason) on conflict(reporter,review_id) do nothing;
end $$;

-- Operator-only lifecycle transitions with audit trail. No browser EXECUTE grants.
create function private.moderate_review(review uuid, decision private.publication_state, reason text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if length(trim(reason)) < 5 then raise exception 'An audit reason is required.'; end if;
  update private.reviews set visibility=decision where id=review;
  if not found then raise exception 'Review not found.'; end if;
  insert into private.moderation_actions(actor,target_id,action,reason) values(session_user,review,decision::text,reason);
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
-- PostgreSQL grants function execution to PUBLIC by default: explicitly revoke each API RPC.
revoke all on function public.kollab_session() from public, anon, authenticated;
revoke all on function public.kollab_search_brands(text,integer,text) from public, anon, authenticated;
revoke all on function public.kollab_create_brand(jsonb) from public, anon, authenticated;
revoke all on function public.kollab_update_profile(jsonb) from public, anon, authenticated;
revoke all on function public.kollab_create_review(jsonb) from public, anon, authenticated;
revoke all on function public.kollab_list_reviews(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.kollab_aggregates(uuid) from public, anon, authenticated;
revoke all on function public.kollab_watchlist(uuid) from public, anon, authenticated;
revoke all on function public.kollab_report(uuid,text) from public, anon, authenticated;
grant execute on function public.kollab_session(), public.kollab_search_brands(text,integer,text),
  public.kollab_list_reviews(uuid,jsonb), public.kollab_aggregates(uuid), public.kollab_watchlist(uuid) to anon, authenticated;
grant execute on function public.kollab_create_brand(jsonb), public.kollab_update_profile(jsonb),
  public.kollab_create_review(jsonb), public.kollab_report(uuid,text) to authenticated;
commit;
