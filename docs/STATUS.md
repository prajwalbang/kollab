# Implementation status

As of this development pass, the code is implemented locally and the hosted site has not been switched to live data. “Implemented” does not mean tested against the actual Supabase/Vercel project.

| Workstream | Implemented | Still needed |
| --- | --- | --- |
| Foundation | Six SQL migrations, private schema, RLS/no client grants, typed HTTP adapter, validation, CI, optional 40-company seed | Apply migrations and verify project settings on staging |
| Accounts | Email PKCE magic link, HttpOnly cookies, sign-out, CAPTCHA integration, profile form | SMTP/sender verification, Turnstile setup, hosted refresh/delivery tests |
| Creator identity | Expiring bio challenges, manual moderator approval, per-post consent for visible handles, anonymous projections | Moderator staffing, account-control dispute process; optional Meta OAuth later |
| Companies/search | Normalized/text search, suggestions, duplicate checks, moderation, merges/redirects, approved representative claims | Directory curation, large-directory pagination and scale testing |
| Reviews/evidence | Review composer and server constraints, pending publication, optional private image evidence, audited moderator preview, expiry worker | Schedule cleanup with a separate maintenance credential; real Storage acceptance tests |
| Community/rates | Moderated rooms/comments, helpful votes, reporting, fixed five-creator rate cells, watchlists and in-app notifications | Operational abuse review; optional outbound notifications; broader pagination |
| Moderation/SEO | Ten queues, audited decisions, self-approval blocking, bans, merge tooling, official replies, anonymous server metadata/OG/sitemap | Real moderation/appeals policy, operator onboarding and hosted search indexing checks |
| Launch hardening | Local permission/CSRF/upload tests, mobile regression checks, production build and dependency audit | Hosted end-to-end tests, independent security review, privacy/terms, account export/deletion, monitoring, edge limits, backups/restore drill |

No hosted credentials, Instagram login, creator research CSV, or service secrets were embedded in the app. No hosted migration or deployment was performed by this pass.

Known product limitations: company reputation statistics use five-creator suppression; medians are in rate cohorts only. Review discovery is bounded to 200 eligible reviews per contributor; public/new-member discovery uses a stable global subset before filtering. Representative views are capped at 100. Search is text/name search rather than semantic search. These limits are explicit MVP boundaries, not unlimited production-scale behavior.
