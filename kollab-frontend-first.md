# Kollab: front-end-first override

Read this together with the main Kollab brief. **Where the two conflict, this file wins.** Everything in the main brief about product, screens, copy, anonymity rules, and visual design still applies in full. Only the implementation layer changes.

---

## Build mode

This pass is **front end only**. No database, no backend services, no auth provider, no deployment concerns. The app must run with `npm install && npm run dev` and nothing else. No environment variables, no accounts, no API keys. If a feature cannot work without a backend, mock it rather than skipping it.

A real Postgres database will be connected later. Your job is to make that swap a one-file change.

---

## Stack for this pass

- Next.js latest stable, App Router, TypeScript strict
- Tailwind CSS v4
- Framer Motion
- Zod for the data schemas
- Fuse.js for fuzzy brand search
- Nothing else. Do not install Supabase, Drizzle, Resend, Upstash, or any auth library.

---

## Data layer

This is the most important instruction in this file. Get it right and the backend swap is trivial. Get it wrong and every component has to be rewritten.

**`lib/data/types.ts`** mirrors the schema in section 4 of the main brief exactly. Same field names, same enums, same nullability. Do not simplify it because there is no database yet.

**`lib/data/repo.ts`** exports a single typed interface, something like:

```ts
export interface KollabRepo {
  searchBrands(query: string, limit?: number): Promise<Brand[]>
  getBrand(slug: string): Promise<Brand | null>
  createBrand(input: NewBrand): Promise<Brand>
  findSimilarBrands(name: string, handle?: string): Promise<Brand[]>
  listReviews(brandId: string, filters?: ReviewFilters): Promise<Review[]>
  createReview(input: NewReview): Promise<Review>
  getBrandAggregates(brandId: string): Promise<Aggregates>
  getRates(filters: RateFilters): Promise<RateRow[]>
  getWatchlist(): Promise<Brand[]>
  toggleWatchlist(brandId: string): Promise<boolean>
  getSession(): Promise<Session | null>
}
```

**Every method is async and returns a Promise**, even though the mock resolves instantly. Components must be written as if data comes over a network: loading states, error states, empty states, all real. Otherwise they will all break the day a real client is plugged in.

**`lib/data/mock-repo.ts`** implements that interface over local fixtures. No component, page, or hook imports the mock directly. They import the interface from a single provider module. Swapping in a real client later means changing one import.

### Fixtures and persistence

- `/data/brands.json`: about 40 real Indian brand and agency entries (name, instagram_handle, category, website, entity_type) with **zero reviews attached**, so search returns useful results immediately. Real names on empty pages is fine and is what the live product will do.
- `/data/reviews.json`: 4 demo reviews on 2 clearly fictional brands, per section 9 of the main brief. Three on one fictional brand, one on another.
- Writes during a session persist to `localStorage` under a namespaced key, merged over the fixtures on load, so adding a brand or posting a review survives a refresh while demoing.
- A dev toolbar, visible only in development, with: reset demo data, and a session switcher that toggles logged out, logged in with zero contributions, and logged in as a contributor. The gate has three states and you need to be able to see all of them without signing up.

---

## Brand lookup and creation

Build this flow carefully, it is the one the client specifically asked about.

1. The brand field in the review composer, and the site-wide search, are both typeahead inputs. Debounce at around 200ms.
2. Fuzzy match with Fuse.js across brand name and Instagram handle. Normalise case, punctuation, spacing, and a leading `@` before matching, so "mamaearth", "Mama Earth" and "@mamaearth" all hit the same record.
3. Results show logo or initial, name, category, a brand or agency tag, and review count. Brands with zero reviews still appear, marked "no reviews yet".
4. The **last row of the results list is always** "Can't find it? Add a brand", including when there are matches. Do not hide the add option behind an empty result, and do not make the user clear the field to reach it.
5. Choosing add opens an inline panel, not a new page: name, Instagram handle, category, website (optional), and a brand or agency toggle.
6. On submit, before creating, run `findSimilarBrands` and if anything scores close, show it as "Did you mean one of these?" with the option to pick it instead. Duplicate brands are the main way this dataset degrades.
7. New brands are created with `status: 'pending_review'`, appear normally to the creator who added them, and carry a small "newly added" marker.
8. After creating, drop the user straight into the review composer with that brand prefilled. Never make them start the flow again.

---

## Mocked, not skipped

Build the full UI for these, backed by the mock repo:

- Instagram sign in and the bio-code fallback: real screens, fake verification that always succeeds after a short delay, with a dev switch to force the failure state so the error copy gets designed
- Proof upload: real file picker and preview, file held in memory only, never uploaded anywhere
- Aggregates: computed client side from the fixture reviews, using the same rules as the main brief including the n=3 suppression
- Notifications and watchlist: local state, real UI
- Brand replies: rendered from fixtures

## Out of scope for this pass

RLS, real auth, email sending, rate limiting, the moderation console, OG image generation, instrumentation, and the SEO work in section 10. Keep the URL structure from section 10 (`/brand/[slug]`, `/agency/[slug]`, `/rates/[category]`) so none of it has to be reworked later.

---

## Definition of done for this pass

- `npm install && npm run dev` runs with no configuration and no errors
- Every screen in section 5 of the main brief is reachable and fully designed, including empty, loading, and error states
- Search finds a brand from the fixtures, and adding a missing brand works end to end into the review composer
- Submitting a review updates the brand's scorecard immediately, and crossing the n=3 threshold visibly switches a brand from "not enough data yet" to real numbers
- All three gate states demonstrable from the dev toolbar
- Works one-handed at 390px
- `README.md` documents the repo interface and the exact steps to swap the mock for a real client
