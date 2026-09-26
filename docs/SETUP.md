# Connecting the hosted app

The code is ready for staging verification. No migration has been applied to the hosted Supabase project by this development session. Keep Production in `demo` until the tests below pass on a separate staging project/deployment. Vercel environment screenshots confirm variable names, not their values or connectivity.

## 1. Database

Use the Supabase SQL editor as project owner, or a locally authenticated Supabase CLI. Apply **all six migrations in filename order** from `supabase/migrations/`. They create objects and are not intended to be rerun. Each migration runs in a transaction. Do not apply blindly over an earlier partially installed schema; check migration history first.

`private` must **not** be in Data API exposed schemas. Keep automatic table exposure off and automatic RLS on. The `public` schema contains explicitly granted RPC functions; all application tables are private, have RLS enabled, and have no client table grants. Authorization runs inside RPCs as well as in website routes. Supabase Auth and Storage schemas must already exist.

Optionally review and apply `supabase/seed.sql`: 40 starter company/agency records from the existing directory. It contains **no reviews, creator accounts, or research CSV data**. Names/handles need human verification. Regenerate with `node scripts/generate-seed.mjs`; it prints SQL without changing the database.

## 2. Vercel environment variables

Set these on a staging deployment first. Keep Preview isolated from Production data.

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | The `sb_publishable_…` key; server environment variable, without `NEXT_PUBLIC_` |
| `APP_ORIGIN` | Exact deployment origin, e.g. `https://kollab-cyan.vercel.app`; no path or query |
| `NEXT_PUBLIC_DATA_MODE` | `demo` until staging is ready; `supabase` enables live UI |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile public site key |
| `SUPABASE_CAPTCHA_ENABLED` | `true` only after enabling matching Turnstile protection in Supabase Auth |

Redeploy after changes. Variables beginning `NEXT_PUBLIC_` are compiled into browser code. The publishable key is safe to expose by design, but this implementation keeps Supabase requests on the server. It is **not** an authorization secret. Never put `sb_secret_…` or a service-role key in the browser or normal website deployment.

For local development copy `.env.example` to ignored `.env.local`. Use `APP_ORIGIN=http://localhost:3000` and open that exact origin. A different hostname fails CSRF checks intentionally.

## 3. Email and CAPTCHA

In Supabase Authentication: email provider on, email confirmation on, anonymous sign-ins off. Set Site URL to your canonical origin. Add the exact callback `https://YOUR-ORIGIN/auth/callback/` and local `http://localhost:3000/auth/callback/`. Narrow existing production wildcards once the callback is verified.

Configure your email provider's SMTP credentials **in Supabase**, verify the sender domain, and test delivery. Supabase's default mail service is restricted and is not the public launch setup. Keep the default magic-link template's confirmation URL so it returns an authorization code for PKCE. Open the email in the browser that requested it. The callback always redirects to `/account/`; arbitrary redirect parameters are ignored.

Create a Turnstile widget for the actual hostnames. Put its secret in Supabase Auth > Attack Protection and its site key in Vercel. Supabase verifies tokens itself, protecting direct Auth API calls. Live production sign-in refuses to operate until the configuration flag and site key are present. A flag alone does not verify the dashboard setting; test it. [Supabase CAPTCHA setup](https://supabase.com/docs/guides/auth/auth-captcha), [Turnstile widget documentation](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/).

## 4. Assign the first moderator

Sign in, open `/account/` once to create the private profile, then use the SQL editor as owner. Find your own user ID in Authentication > Users. Substitute only a verified operator account:

```sql
insert into private.user_roles(user_id, role)
values ('YOUR-AUTH-USER-UUID', 'admin');
```

Visit `/admin/`. Never assign roles from user-editable metadata. Set up a second moderator for reviewing another moderator's own content. Moderators cannot approve themselves. Bio verification is manual: independently open the Instagram profile, check the exact temporary code, and record a decision reason. It verifies account control at that moment, not the truth of a review. Verification expires after 90 days.

## 5. Evidence retention

The private `review-proofs` bucket accepts static images; the website accepts up to 4 MB to leave room under Vercel's request limit. It decodes, strips metadata and re-encodes JPEGs. Moderator previews repeat decoding. Do not promise automated redaction: creators must redact third-party identities and financial details themselves.

Evidence becomes inaccessible after 30 days. **Physical deletion needs a scheduled worker.** On a trusted operator runner, set the project URL and `SUPABASE_MAINTENANCE_KEY=sb_secret_…` through a secret store. This elevated credential belongs only to maintenance, not the web app. Run:

```sh
node scripts/expire-proofs.mjs         # dry run, count only
node scripts/expire-proofs.mjs --apply # delete expired objects via Storage API
```

Schedule daily, monitor failures, and test with an expired test image. Up to 10,000 expired objects are processed per run. Never delete rows directly from `storage.objects`; that does not remove the underlying object. Agree on retention policy and backup retention before collecting real evidence. `delete_after` is a proposed 30-day default, not a claim of legal compliance.

## 6. Hosted acceptance checks before changing Production

- A new email can sign in, expired links fail, cross-browser PKCE links fail safely, and sign-out removes local access.
- Two separate accounts cannot see each other's profile, Instagram verification, evidence or saved companies, including through direct REST/RPC calls.
- An unverified creator cannot post. A moderator approves a submitted bio code. Anonymous reviews hide the handle; attributed reviews require explicit consent and display only the verified handle.
- Company suggestions and reviews start pending. A second moderator publishes them. Five separate verified contributors are needed for rate cells. Refresh rate snapshots through Admin, then test small cohorts and filters.
- Rooms, comments, votes, reports, watchlist and notifications persist between browsers.
- Representative claims need independent manual verification. Approved representatives can read their company's published reviews and submit a moderated response. Revoking the claim hides the response.
- Real Storage rejects other-user uploads, overwrite attempts and unauthorized reads. Check actual image delivery and retention removal. Local tests emulate Storage policies, not the hosted Storage service.
- Check the site's metadata, canonical redirects after company merges, sitemap, errors and mobile flows with real data. Do not index fictional demo reviews.

## 7. Launch operations still required

Choose a support/appeals contact; finish privacy notice, terms, community policy and account export/deletion workflow. Establish moderator coverage and escalation rules. Configure request/firewall limits, SMTP monitoring, backup/restore testing and alerting that redacts tokens and personal data. Review accessibility and have an independent security review before a broad public launch.

GitHub Pages cannot run these server routes. The old static-export workflow is removed; Vercel is the application host. GitHub Actions now runs tests/builds. This change does not itself push or deploy code, apply SQL, or switch the hosted site to live mode.
