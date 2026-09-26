# Security model and verification limits

## Boundaries

- Browser → same-origin Next.js routes → Supabase with the user's JWT. HttpOnly, SameSite=Lax cookies; Secure in production. No service-role bypass in the web app.
- Mutations validate the configured `APP_ORIGIN`, content type, streamed body size and allowlisted fields. Auth code exchange uses a fixed callback destination. Errors omit raw SQL/provider messages.
- Authorization lives in SQL too: private schemas, no client table grants, RLS, narrow security-definer functions with empty search paths and explicit public projections. Each mutation checks email confirmation, bans and relevant verification/role/ownership requirements. Treat every RPC as publicly callable; hiding keys or buttons is not access control.
- Anonymous review projections omit user IDs, exact creation dates, city, proof paths and Instagram identities. Attribution is a per-post consent snapshot from a verified record. Owner identity and verification are still available to trusted database operators. This is public pseudonymity, not anonymity from the service operator. Private-schema isolation is not application-level field encryption.
- Admin queues and decisions require database-assigned roles. Moderation is audited; self-approval is blocked. Admins alone can ban creators/merge companies. Audit records include private context and must be restricted operationally.
- Evidence uses random reserved paths, owner-only insert policies, no overwrite and no creator download. Moderators need a recently audited access event. The UI serves re-encoded image bytes, never signed raw URLs. Direct Storage uploads can bypass the website's re-encoder; MIME/size policy applies there, while the moderator preview decodes again. No malware scanning or automated PII detection is claimed.

## Known limits

- PGlite tests exercise PostgreSQL roles/functions and emulated `auth.uid()`/Storage tables. They do not prove hosted PostgREST schema configuration, Auth delivery, refresh behavior, real Storage, CDN caching or Vercel networking. Complete hosted acceptance tests before launch.
- Auth CAPTCHA needs real Supabase enforcement. Database write throttles count successful transactions per account; failed transactions roll back their counters. They do not replace edge/IP request limits, Sybil defense, global abuse quotas or spending alerts.
- Guest/new-member review allowances are global before filtering, preventing simple brand/query enumeration. They are bounded snapshots (1 guest, 3 new member, up to 200 contributor). Sets can change with publication; this is not a permanent privacy guarantee or a full pagination system. Approved representatives have a separate bounded view of their own company.
- Rates use fixed company/category/follower-band/deal/deliverable cells with five distinct creators, rounded medians, count bands, no extrema or city cuts, and batched refresh. This is not differential privacy. Outside knowledge and exact amounts creators choose to publish in reviews can enable inference. Company reputation percentages update as reviews change; they have five-creator suppression but are not protected against longitudinal differencing.
- New content is moderated before public display. Plain text is rendered through React escaping; no user HTML. Human moderators must still handle defamation, doxxing, fabricated evidence and disputes. A verified Instagram handle is evidence of account control, not a guarantee of honesty.
- Physical evidence deletion requires the maintenance worker; inaccessible is not deleted. Account deletion/export, retention of audits, backup expiry and legal policy need operational completion. Do not collect real private evidence without a working cleanup schedule.
- Search is PostgreSQL text search plus normalized names, not semantic search. Directory/list endpoints are bounded; large-scale pagination, external search indexing, reporting analytics and load testing remain future work.
- Demo mode disables the website's live API routes. It is not a Supabase kill switch: direct project APIs remain governed by Auth settings and SQL grants.

## Local coverage

`npm test`: demo regression checks; migrations executed from scratch; guest/user/admin/representative role boundaries; own-versus-other verification/evidence; anonymous projections and explicit attribution consent; moderation publication; small-cell suppression and ban invalidation; claim approval/revocation; maintenance grants; CSRF, request limits and image sanitation.

`npm run test:browser` against the local dev server: demo search/posting/saved/rooms, review expansion and mobile overflow; new account and moderation controls with mocked API responses. The mocked checks are UI contracts, not hosted integration tests.

Production dependency audit was clean at development time. That is a point-in-time dependency check, not proof that the application is free of vulnerabilities.
