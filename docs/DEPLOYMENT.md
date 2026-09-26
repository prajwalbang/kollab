# Hosted deployment — 26 September 2026

Application: https://kollab-cyan.vercel.app

Supabase project: `vtkykdzsaerjxbzzzglk`. GitHub repository: `prajwalbang/kollab`.

## Completed

- Application commit `6af3fa0` pushed; GitHub tests/build/typecheck succeeded and Vercel reported deployment success. Home/account endpoints respond with HTTP 200. `/api/session/` confirms sign-in unavailable in demo mode.
- Applied foundation, product, moderation, proofs, retention, representatives and hosted-hardening migrations. The repository filenames now use the versions assigned by Supabase so future CLI migration comparisons do not treat the already deployed schema as new.
- Seeded 40 company/agency records. No fictional reviews or creator research records were uploaded.
- Verified all 19 private tables have RLS enabled and no direct SELECT/INSERT/UPDATE/DELETE grants for `anon` or `authenticated`.
- Verified private-schema REST requests are blocked. Public directory/search and guest projections work. Guest admin, write, evidence-access and maintenance RPCs reject requests.
- Verified the evidence bucket is private with image MIME and size restrictions.
- Ran `supabase/tests/hosted-authorization.sql` on the hosted database: regular-user/moderator boundaries, private identity access, separate-account verification isolation, verified posting, explicit attribution consent and publication visibility. All synthetic users/content were rolled back. Verified afterwards: 0 auth accounts, profiles, reviews and posts; 40 companies remain.
- Public Auth settings confirm email enabled, confirmation required, anonymous auth disabled and signups enabled. This does **not** verify SMTP delivery or CAPTCHA configuration.
- Revoked unnecessary client execution grants on the dashboard-created automatic-RLS event-trigger helper. Added twelve missing foreign-key indexes.

## Advisor interpretation

Security advisor still reports [RLS enabled without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) for private tables. This is intentional default denial: clients have neither schema/table access nor policies; approved operations go through narrowly defined RPCs.

It also reports [guest-executable security-definer functions](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) and [authenticated-executable security-definer functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). These are the intentional API entry points; role/ownership checks and public projections are enforced inside them. Do not blindly change them to invoker or grant direct private-table access to silence the advisor. Their authorization logic still needs independent review before broad launch.

Performance advisor now reports only [unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), expected for a new database with no user activity. Missing foreign-key index notices are resolved.

## Pending before opening public accounts

The owner confirmed that neither custom SMTP nor Turnstile is configured yet. Configure the sender domain/provider, enable Supabase-native CAPTCHA, set Vercel's public Turnstile site key and configuration flag, and test real email login, session refresh, logout, posting and Storage. Then assign the verified owner account a moderator/admin role and schedule evidence cleanup. No admin role has been assigned yet because no real account exists.

Keep `NEXT_PUBLIC_DATA_MODE=demo` until these checks pass. The existing Vercel variables have not been inspected or changed by the Supabase connection. No elevated maintenance key has been added to the web app. Privacy/support policy, account export/deletion, monitoring and restore drills remain launch work described in SETUP and SECURITY.

## Repeatable checks

```sh
npm test
node --env-file=.env.local scripts/check-hosted.mjs
```

The second command only performs public read/API-access checks and never sends email or creates accounts. The SQL smoke-test file requires a trusted database operator and rolls back its temporary records; it is not a substitute for real Auth JWT or Storage service testing.
