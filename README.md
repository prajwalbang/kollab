# Kollab

A front-end-only creator collaboration directory. Next.js App Router, strict TypeScript, Tailwind CSS v4, Framer Motion, Zod, and Fuse.js. No credentials or external services are needed.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000. `npm run build` checks the production build using Next.js’s supported webpack option; `npm run typecheck` checks TypeScript. Node 20.9 or later is required.

## GitHub Pages

The repository includes `.github/workflows/deploy-pages.yml`. Every push to `main` builds the static export with `/kollab` as its base path and deploys `out/` through GitHub Pages. After the first workflow completes, the site is available at `https://prajwalbang.github.io/kollab/` (or the Pages URL shown by GitHub). Enable **Settings → Pages → Source: GitHub Actions** if GitHub asks for a Pages source on first setup.

To publish a new version:

```sh
git add .
git commit -m "Update Kollab"
git push origin main
```

## Demo

Discover 40 real Indian brands/agencies with zero fixture reviews. Four fictional sample reviews are attached to Sunday Theory (three) and Peach Club (one). Fictional content is labeled. Search normalizes punctuation, spacing, and handles before fuzzy matching. The last result always allows inline brand creation; potential duplicates are checked before saving. A created brand leads directly to the review composer, through simulated sign-in if necessary.

Navigation includes community reviews, rate explorer, and a persistent watchlist. Brand pages use `/brand/[slug]` and `/agency/[slug]`; rate categories use `/rates/[category]`. Logged-out users see one full review; new creators see three; a contribution unlocks all reviews and the rates explorer. Brand and category aggregates require three reviews. Try adding two reviews to Peach Club to see the threshold change.

The development toolbar switches logged out / new creator / contributor, forces simulated authentication failures, and resets local demo data. Instagram and bio-code verification are simulated. Proof is previewed from an in-memory object URL, never uploaded or persisted. Brand replies are rendered from fixtures. Notifications are generated locally for new reviews on watched brands; no outbound notification service is connected.

Writes persist in `localStorage` under `kollab:demo:v2`, merged with fixtures on load. Reset clears only this key. Demo authentication is not a security boundary. No real identities or confidential proof should be entered into this prototype.

## Repository boundary and backend swap

`lib/data/types.ts` defines domain types and Zod input schemas. `lib/data/repo.ts` defines the async `KollabRepo` contract. UI components only use `repo` from `lib/data/provider.ts`; no component imports fixtures or the mock implementation. Every repository method returns a Promise.

To connect a backend:

1. Implement `KollabRepo` in a real client, preserving domain objects and Promise signatures. Put session, validation, anonymity, moderation, visibility, and aggregate suppression enforcement on the server.
2. Change the import and exported instance in **`lib/data/provider.ts`** from `mockRepo` to that client. This is the single UI wiring change.
3. Implement the development-only session/reset methods safely for that environment. Real authentication and file uploads need their own integrations; the current UI explicitly describes its simulated behavior.

## Design and scope

The latest user-provided direction takes precedence: Kollab now ships in permanent light mode with frosted glass, a blurred yellow `kollab.` backdrop, and floating pill navigation. Desktop exposes all five destinations in the top capsule. Mobile uses a compact utility bar plus a five-item bottom navigation so Discover, Reviews, Rooms, Rates, and Saved are always reachable. Mobile brand cards expand to the full viewport width for readable text and reliable tap targets. The final theme overrides live in `app/wordmark-backdrop.css`.

Both `kollab-build-prompt-v2.md` and `kollab-frontend-first.md` are implemented with the latter taking precedence. The main brief arrived during development and the app was revised to its translucent material system, self-hosted Geist, semantic trust scale, and mobile bottom sheets. See `DESIGN.md` and `DECISIONS.md` for assumptions and the mocked service boundaries.

The seven-step review wizard collects brand/agency, month, deal terms, deliverables, payment outcome, rights, ratings, an optional note and in-memory proof, ending in the exact anonymous public-card preview. Brand pages offer overview/reviews/rates/discussion. Rooms support local posts, comments, helpful votes, and reports. Share cards support screenshots, copy-link, and native sharing / print fallback. Rate filter URLs are persistent.

Types mirror the fields explicitly listed in the main brief. `BrandRecord` and `CollabReview` are storage shapes; public `Brand` and `Review` projections remove identifying fields at the repository boundary. Three-review suppression applies to each eligible aggregate group. Proof-verified fixtures are weighted above unverified fixtures; new-account reviews receive half weight.

The local content filter and identity projections are demonstrable frontend protections, not production security. All real authorization, moderation, proof review, retention, and database constraints belong in the future server adapter. The front-end override explicitly excludes backend services, email sending, moderation console, instrumentation, SEO/OG generation, and deployment work.

## Verification

- `npm run typecheck`
- `npm run build`
- `npm test` exercises fuzzy search, public identity stripping, fixture integrity, weighted aggregation, duplicate-review rejection, contribution state, and local persistence.
- Mobile browser verification uses temporary Playwright tooling outside the app dependency tree; see `tests/browser-flows.cjs`. Run with `PLAYWRIGHT_MODULE=/path/to/playwright node tests/browser-flows.cjs` while the dev server is running.

Community opinions, rates, room discussions, and saved brands each have a dedicated debounced search. Rate searches are included in shareable URLs and are applied before aggregate suppression. Click an unlocked review card or “Read the full experience” to expand it into a centered, animated detail view; Escape, backdrop click, and the close button dismiss it. Keyboard focus and reduced-motion behavior are supported. The current background renders the yellow `kollab.` wordmark directly in the page, so it needs no image asset.

Additional browser checks: `PLAYWRIGHT_MODULE=/path/to/playwright node tests/search-detail.cjs` verifies all four searches, gate preservation, rate-query persistence, mobile expansion, keyboard dismissal, and reduced motion.
