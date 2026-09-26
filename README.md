# Kollab

Creator collaboration directory built with Next.js, React and TypeScript. Permanent light glass UI, mobile navigation, searchable company profiles, reviews, rates, rooms and saved companies.

The repository now includes a Supabase implementation alongside the original local demo. **Hosted activation is still pending.** No real database credentials are required for demo mode.

## Run locally

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. Use Node 22 or later. Copy `.env.example` to `.env.local` only when configuring a local Supabase connection; credentials stay ignored by Git.

`NEXT_PUBLIC_DATA_MODE=demo` (default) uses fixtures and localStorage under `kollab:demo:v2`. Real directory entries have no fictional reviews; sample experiences belong to clearly labeled fictional companies. Demo auth and verification are simulated. Never enter confidential data in demo mode.

`NEXT_PUBLIC_DATA_MODE=supabase` selects same-origin server APIs backed by Supabase. Email magic links, manual Instagram ownership verification, per-post anonymous/attributed identities, pending moderation, private evidence, company suggestions/claims, official replies, community posts/comments, reports, votes, saved companies and in-app notifications are implemented. Database permissions enforce access even when someone bypasses the frontend.

## Setup and operations

- [Hosted setup and acceptance checklist](docs/SETUP.md): migrations, Vercel variables, SMTP, CAPTCHA, moderator assignment and evidence cleanup.
- [Security boundaries and remaining risks](docs/SECURITY.md): what is enforced, what was tested, and what still requires hosted validation.
- [Implementation status](docs/STATUS.md): delivered functionality and remaining launch work.

Supabase SQL lives in `supabase/migrations/`. `supabase/seed.sql` optionally seeds company metadata only. `indian_microcreators_master.csv` remains local and ignored; application code and seed scripts do not read it.

Vercel hosts the server application. GitHub Pages cannot run the new auth/API routes; its old deployment workflow has been replaced with CI checks. Pushing code does not apply SQL migrations. Keep the hosted site in demo mode until acceptance tests pass.

## Architecture

`lib/data/provider.ts` selects the demo or HTTP repository. `app/api/data` validates browser requests and calls bounded SQL RPCs using the user's session. `lib/supabase` handles server-only configuration, HttpOnly cookies and request protections. The normal website uses only a publishable key—never an elevated service key.

`/account/` handles email sign-in, profile settings and bio-code verification. `/admin/` contains role-protected moderation queues and audited actions. `/represent/` handles company claims and official responses. Company pages have server-rendered public data, metadata, social images and merged-company redirects.

Live rates use fixed cohorts of at least five distinct creators, rounded medians and bucketed sample sizes; arbitrary city breakdowns are disabled. Demo statistics retain the original three-review thresholds. Public anonymity hides the handle, but details in a story may still identify its author.

## Checks

```sh
npm test
npm run build
npm run typecheck
# With the dev server on 127.0.0.1:3000:
npm run test:browser
```

Tests include a PostgreSQL-compatible PGlite migration/authorization suite and browser flows. New account/moderation browser checks use simulated API responses and are not hosted integration tests. See the security document for limits. `npm audit --omit=dev` checks current production dependency advisories.

Original design briefs and `DESIGN.md`/`DECISIONS.md` describe the frontend iteration. Where they describe a frontend-only scope, the newer setup/status documentation supersedes that scope.
