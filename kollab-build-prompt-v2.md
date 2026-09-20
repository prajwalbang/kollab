# Kollab: build brief (v2)

You are the founding engineer and design lead for **Kollab**. Build it end to end: schema, backend, frontend, seed data, moderation tooling, deploy config. Work autonomously. Where this brief leaves a decision open, make the call, log it in DECISIONS.md, keep building. Ask questions once, in a single batch, only if genuinely blocked.

---

## 0. Non-negotiables

Read these first. Everything else is detail.

1. **Anonymity is a security property, not a feature.** A deanonymisation bug ends the product. See section 7.
2. **The rate data is the retention engine**, not the reviews. Build the product around a creator checking rates before answering a DM.
3. **No fabricated reviews about real companies, ever.** Demo reviews attach only to fictional brands. See section 9.
4. **Mobile first at 390px.** Desktop is secondary. Most sessions are a phone browser opened from an Instagram DM.
5. **Search engine traffic is the acquisition channel.** Brand pages must be indexable and fast. See section 10.
6. **Apple-esque translucent material design**, executed with restraint. Pinned. See section 6.

---

## 1. What Kollab is

Micro influencers (roughly 1k to 50k followers) do most of their brand deals over Instagram DMs with no contract. They get ghosted after delivering content, lowballed, paid three months late, sent a product worth a fifth of what was promised, or have their content run as a paid ad with no extra payment. There is no shared record of which brands and agencies behave well.

Kollab is Glassdoor plus Blind for brand collabs. Verified creators anonymously review the brands and agencies they have worked with, report what they were actually paid, and warn each other.

**Primary market: India.** Instagram creators.

### The one job of v1

To be the thing a creator opens before replying to a brand's DM.

A creator gets ghosted maybe once a quarter but negotiates every week, so the reason to return is not the rants, it is knowing that Brand X pays 10k to 25k fitness creators in Bangalore around Rs 8,000 plus product and takes 47 days to pay. Levels.fyi for collabs. Reviews generate the rate data, rate data generates the return visits.

The loop:

**search a brand -> see what they pay and how they behave -> contribute your own collab to unlock more -> get notified when new data lands on brands you follow -> come back before the next deal.**

Long term, not in scope but do not architect against it: Kollab becomes where these collabs get booked, with escrow. The entity model, the rate data, and the tone all need to survive brands onboarding as customers later. Kollab is a transparency utility, not a hate site.

---

## 2. Scope

**In:** Instagram-verified pseudonymous accounts, brand and agency pages with aggregate scores, structured collab reviews with private proof upload, rates explorer, search, watchlist and notifications, give-to-get gating, category rooms, brand right of reply, moderation console, shareable rate cards, seeded brand pages.

**Out, do not build:** payments, escrow, booking, brand dashboards, user-to-user DMs, native apps, any AI feature, any chatbot.

---

## 3. Stack

- Next.js latest stable, App Router, TypeScript strict
- Tailwind CSS v4
- Supabase: Postgres, Auth, Storage, RLS
- Drizzle ORM, typed queries, checked-in migrations
- Framer Motion, used sparingly per section 6
- Resend for transactional and digest email
- Upstash Redis for rate limiting
- Vercel, all config in repo
- Vitest and Playwright on the critical flows

shadcn/ui is allowed as an unstyled base. The result must not look like default shadcn.

---

## 4. Data model

Use Postgres enums where sensible.

**users**
`id, instagram_user_id, handle_encrypted, alias, avatar_seed, follower_band, primary_category, secondary_categories[], city, region, verified_at, verification_method, karma, contribution_count, role (creator | moderator | admin | brand_rep), created_at, banned_at, ban_reason`

`follower_band` enum: under_1k, 1k_5k, 5k_10k, 10k_25k, 25k_50k, 50k_100k, over_100k. Bands only. An exact follower count is an identifier, never store it on a public surface.

**brands**
`id, name, slug, logo_url, website, instagram_handle, category, entity_type (brand | agency), hq_city, is_claimed, claimed_by_user_id, status (active | pending_review | merged | hidden), merged_into_id, created_by_user_id, created_at`

Agencies are first class. Much of the bad behaviour comes from the influencer marketing agency rather than the brand, and the same brand can be excellent in-house and awful through a third party. A review tags a brand and optionally an agency, and counts toward both.

**collab_reviews**
```
id, user_id, brand_id, agency_id (nullable), collab_month (month precision, never an exact date),
deal_type (barter | paid | paid_plus_product | affiliate_only | exposure_only),
cash_amount_inr, product_claimed_value_inr, product_actual_value_inr,
deliverables (jsonb: reels, stories, static_posts, ugc_raw, event_attendance),
initial_offer_inr, final_amount_inr,
payment_status (paid_on_time | paid_late | partially_paid | never_paid | not_applicable),
days_to_payment,
ghost_stage (none | before_agreement | after_agreement | after_content_sent | after_posting | during_payment),
usage_rights_requested, usage_rights_paid_separately, ran_as_paid_ad_without_payment (bools),
revisions_requested (int), scope_creep (bool), had_written_agreement (bool),
rating_communication, rating_professionalism, rating_payment (1 to 5),
would_work_again (bool),
body (text, max 1200 chars, optional),
proof_status (none | pending | verified | rejected),
visibility (published | pending_review | removed),
trust_score (computed, see 4.2), helpful_count, created_at, edited_at, removed_reason
```

Structure over prose. Free text is a legal liability and useless for aggregation. Body is the last step of the form and optional.

**review_proofs** (private, never on any public endpoint)
`id, review_id, storage_path, proof_type (dm_screenshot | email | invoice | contract | bank_credit), reviewed_by, verdict, reviewed_at`

Moderator-reviewed proofs earn a "receipts verified" badge and rank the review higher. Proof files are never publicly readable: RLS plus signed URLs restricted to moderators.

Also: **brand_replies** (one per review, from a verified brand rep, labelled), **watchlist**, **helpful_votes**, **posts** and **comments**, **rooms**, **reports**, **notifications**, **brand_aggregates** (materialised view refreshed on write), **events** (section 12).

### 4.1 Aggregation

Per brand: would-work-again percentage, ghost rate, median days to payment, on-time rate, median cash by follower band and category, claimed vs actual product value, sample size.

**Never display an aggregate computed from fewer than 3 reviews.** Show "not enough data yet". With one or two reviews in a narrow band, a brand can work out who wrote it.

### 4.2 Review integrity

Assume adversaries from day one. Brands will astroturf positive reviews about themselves and negative ones about competitors.

- One review per user per brand per collab_month. Enforce at the DB level.
- Account age and karma gate: a brand new account's reviews publish but carry lower weight in aggregates until the account is 7 days old or has a verified proof.
- Flag for moderation: multiple reviews of the same brand from accounts created the same day, accounts reviewing only one brand, reviews from accounts whose verification is the weakest tier.
- Verified-proof reviews weight higher in every aggregate.
- Surface a "review integrity" queue in the moderation console showing these clusters.

---

## 5. Screens and flows

### 5.1 Landing, logged out

Hero is a single search field: "Check a brand before you sign." Not a marketing headline. The visitor has a DM open in another tab and fifteen seconds of patience.

Below: a live strip of recent anonymised activity ("A 10k to 25k beauty creator in Mumbai reported being ghosted after posting"), and the most-reviewed brands this week.

### 5.2 Verification and onboarding

Sign in with Instagram, verify handle ownership, pull the follower count, immediately discard the exact number and keep only the band. The handle is never displayed.

Instagram API approval takes time, so build a **fallback verification path as a first-class flow, not a stub**: user enters handle, Kollab issues a short code, user puts it in their bio or story, Kollab checks, user removes it. Assume you are shipping on this path.

Onboarding: pick an alias, confirm band, categories and city, then straight into adding a first collab. A user who signs up and contributes nothing is worth nothing here.

### 5.3 Brand page

Header: name, logo, category, brand or agency, claimed status, watchlist button.

Scorecard is the most important component in the product: would-work-again percentage as the headline, then payment reliability, median days to pay, ghost rate, sample size, colour-coded by the semantic scale in section 6.

Tabs: **Overview** (scorecard, payment behaviour over time, agencies this brand works through, most helpful reviews), **Reviews** (filter by band, category, deal type, year, verified-proof pinned), **Rates** (what they paid by band and deliverable, medians and ranges), **Discussion**.

### 5.4 Brand creation and dedupe

Creators will create brands while writing a review, and they will create duplicates. Handle it properly.

- Typeahead search with fuzzy matching on name and Instagram handle before any create option appears
- On create, warn if a close match exists and show it
- New brands enter `pending_review` and their pages are noindex until approved
- Merge tool in the moderation console that repoints reviews and leaves a redirect from the old slug

### 5.5 Review composer

Multi-step wizard, one question group per screen, progress indicator, completable one-handed in under three minutes. Mostly taps, minimal typing.

Steps: brand, agency if any, when, deal type and numbers, deliverables, payment outcome, usage rights, ratings, would you work again, optional note, optional proof.

Final step shows **"here is exactly what others will see"** as the rendered anonymised card. This does more for contribution rates than anything else you could build, because the thing stopping people is fear of being identified.

### 5.6 Rates explorer

The levels.fyi surface. Filter by category, band, deal type, city, deliverable. Medians, ranges, sample sizes. Answers "what should I be asking for" in one screen. Every filter state is a shareable URL.

### 5.7 Give-to-get gate

- Logged out: scorecard and one full review, rest locked
- Logged in, zero contributions: three reviews, rates explorer locked
- One or more contributions: everything unlocked

Render locked content as genuinely frosted unreadable content behind the material, not an empty box. The reader should see the shape of what they are missing. This is where the translucent direction does a job instead of decorating.

On a light background, blur alone leaves text partly legible and looks like a rendering bug rather than a deliberate lock. Combine a heavier blur with a white scrim at around 0.55 alpha over the locked region, so it reads as frosted glass with shapes behind it. Verify at 390px that no locked text can actually be read, including by zooming into a screenshot.

### 5.8 Shareable rate cards

Creators will screenshot this into WhatsApp groups, so design for it rather than letting them screenshot a half-scrolled page.

- A "share" action on any brand scorecard and any rates-explorer filter state
- Dynamically generated OG images for brand pages and rate views, branded, readable at thumbnail size, containing the headline number and sample size
- Short share URLs

This is the cheapest acquisition loop in the product. Do not skip it.

### 5.9 Rooms

One anonymous feed per category, text posts and comments, helpful votes, report button. Minimal. It exists so people have a reason to open Kollab on a day they are not negotiating.

### 5.10 Watchlist and notifications

Follow a brand, get notified on new reviews, red flags, and brand replies. Weekly digest email: watchlist activity, new reviews in your category, notable rate movements. Email is the retention channel, so invest in the template.

### 5.11 Moderation console

Reported content queue, pending proof verifications, review integrity clusters, takedown requests, brand merge queue, brand claim approvals, user bans. Every action logged with actor and timestamp. Built in the same sprint as the features it polices, not after.

---

## 6. Design direction

**Apple-esque: layered translucent materials, real depth, generous space, restraint.** Pinned requirement.

Two passes. First write a short design plan with tokens and ASCII wireframes for landing, brand page, and review composer. Review it and strip anything that reads as generic AI glassmorphism: rainbow gradient blobs behind frosted cards, purple-to-pink hero washes, identical rounded cards with the same soft grey shadow, all-caps tracked-out eyebrow labels above every heading, monospace used decoratively for small labels. Then code.

### Materials

A small set of named materials, Apple style, not random alpha values. **Light mode is the primary mode.** Ship dark mode too, but design, review, and screenshot in light.

Light glass is white at high alpha over a tinted backdrop, which is the opposite construction to dark glass. Get this right or it looks like flat white cards.

- `--mat-thin`: rgba(255,255,255,0.50), blur 20px, saturate 180%
- `--mat-regular`: rgba(255,255,255,0.68), blur 40px, saturate 180%
- `--mat-thick`: rgba(255,255,255,0.82), blur 60px, saturate 180%
- Hairline borders rgba(16,24,40,0.08) at 1px
- A soft low shadow on raised panels: `0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)`

**Depth works differently in light mode.** In dark mode a glass panel separates from the page by being lighter. In light mode everything is already bright, so luminance cannot do the work. Separation comes from the shadow, the hairline, and the saturation boost picking up colour from whatever sits behind the panel. Do not skip the shadows here, and do not compensate by making borders heavy.

The backdrop must be tinted, not white, or the translucency is invisible. Static, muted, low contrast, never a colourful gradient. Every translucent surface stays readable while content scrolls behind it. Solid fallback for `backdrop-filter`, and respect `prefers-reduced-transparency`.

### Colour

- Page base `#F1F2F6` (cool light grey, deliberately not white and deliberately not a warm cream)
- Raised base `#FFFFFF`
- Text `rgba(16,24,40,0.92)` primary, `rgba(16,24,40,0.60)` secondary, `rgba(16,24,40,0.40)` tertiary
- Brand accent `#3A5BD9`, interaction only. Light backgrounds need a darker accent than dark mode does, so do not reuse a pastel blue here.

Semantic trust scale, the heart of the interface, never confused with the brand accent. These are the light-mode values, darkened from their dark-mode equivalents so they pass contrast on white:

- Good `#0E9F6E`, Caution `#C2710C`, Bad `#D0342C`, Unknown `rgba(16,24,40,0.28)`

Amber is the dangerous one on light backgrounds. Never put amber text on a white or near-white fill without checking the composited contrast. If a tinted badge is needed, use a 10 percent wash of the semantic colour with the full-strength colour as the text.

Every score, badge and chart reads from this scale and only this scale. That is what makes a brand page scannable in two seconds.

### Type

One family with a real weight range and excellent numerals. Not Inter, it is the default tell. Geist, General Sans, or Instrument Sans. Proper type scale.

Numbers are content here, not decoration. **Tabular lining figures** anywhere a number sits in a column or comparison. Indian number formatting (Rs 1,20,000, lakh where it reads naturally).

### Motion

One orchestrated moment, not scattered effects. No fade-and-slide-up on every section, no hover transition on every card.

Spend the budget on sheet and modal transitions (iOS spring, bottom sheets rather than centred dialogs on mobile), the review wizard step transitions, and number transitions when a score updates. Everything else is still. Respect `prefers-reduced-motion`.

### Copy

Plain, direct, sentence case, written for a 22-year-old creator in India, not a B2B SaaS buyer. No corporate voice, no exclamation marks, no "Oops!". Empty states say what to do. Errors say what broke and how to fix it. Buttons say what happens: "Post your collab", not "Submit".

---

## 7. Anonymity

- No public endpoint returns `user_id`, Instagram handle, exact follower count, exact collab date, or anything from `review_proofs`. Strip at the query layer, not the component layer.
- RLS on every table, default deny. The anon key cannot read identities.
- Aggregates suppressed below n=3.
- Contribution history private by default, visible only to its owner.
- Rate limit review submission, brand creation, and account creation.
- No third-party analytics script that can read review content. Self-host or use a privacy-preserving option.

---

## 8. Legal and moderation

Market is India: defamation carries criminal exposure and intermediaries have specific obligations. Research the current position yourself, do not assume.

- Reviews framed as first-hand experience of a specific dated collab, which is why structured fields dominate
- Pre-publish filter blocking named individuals, contact details, and slurs. Companies and agencies can be named. Employees cannot.
- Brand right of reply, one per review, labelled official
- Dispute and takedown workflow with a human reviewer, published grievance contact, acknowledgement and resolution SLAs, full audit log
- Terms, privacy policy, community guidelines reflecting Indian data protection obligations
- Proof retention so a challenged review can be substantiated

---

## 9. Seeding and cold start

An empty review site is dead on arrival.

1. Ingest `/data/brands-seed.csv` (name, instagram_handle, category, website) into real but empty brand pages so search returns results on day one. I will supply this from an existing dataset of Indian micro-creators and the brands they have worked with.
2. Ingest a creator email CSV for an invite flow. The claim link maps a creator to brands they have already worked with and prompts them to review those specific collabs, brand pre-filled.
3. Dev demo data: **4 fictional-brand reviews only.** Three on one fictional brand so a populated scorecard and rate row render, one on a second so the "not enough data yet" state renders. Vary the three (one clean paid deal, one slow payer, one ghost after posting), not all negative. Flagged as demo, removable with one command, and the seed script parameterised so the count can be raised later.
4. Launch category is beauty and skincare, the most collab-heavy vertical. Make featuring one category on the landing page trivial.

---

## 10. Search traffic

Glassdoor was built on people searching a company name plus "reviews". Same here, so brand pages are the SEO surface.

- Clean URLs: `/brand/[slug]`, `/agency/[slug]`, `/rates/[category]`
- Server-rendered brand pages with real metadata, structured data, and a summary paragraph generated from the aggregates at build or request time
- The scorecard and at least one review render server side, above the gate, so there is indexable content
- Sitemap covering all active brands, regenerated on brand creation
- Pages for brands with zero reviews are noindex until the first review lands, so the index does not fill with empty shells
- Fast. Blur is expensive, keep the brand page under the budget in section 13.

---

## 11. Build order

Each milestone works before the next starts.

1. Schema, RLS, auth, both verification paths, seed ingestion
2. Brand pages, brand creation and dedupe, review composer, aggregation, anonymity guarantees
3. Search, rates explorer, give-to-get gate, share cards and OG images
4. Watchlist, notifications, digest email
5. Rooms, brand replies
6. Moderation console, review integrity queue, reporting, legal pages
7. Design pass: full material system, motion, empty states, mobile polish

---

## 12. Instrumentation

The goal of v1 is engagement, so it has to be measurable. Log events to an `events` table (self-hosted, no third party) and build a single internal metrics page:

Events: signup started and completed, verification method used and outcome, review started, review abandoned by step, review submitted, proof uploaded, gate hit, gate converted, search performed and whether it returned a result, brand page viewed, rates explorer filtered, share card generated, watchlist added, digest opened and clicked, return visit within 7 and 30 days.

The two numbers that matter: **percentage of signups that submit at least one review**, and **7-day return rate**. Put both at the top of the page.

Also log searches that returned nothing. That list is the roadmap for which brands to seed next.

---

## 13. Definition of done

- Works one-handed at 390px. Test there first.
- Lighthouse performance above 90 on mobile for the brand page despite the blur. Do not stack materials more than two deep.
- Keyboard navigable with visible focus. AA contrast verified against the actual composited translucent result, not the token value.
- `prefers-reduced-motion` and `prefers-reduced-transparency` honoured.
- A test asserting no public API route leaks identity fields. Run it against every route.
- Every empty state designed and written.
- Playwright: sign up, verify, create a brand, submit a review, hit the gate, unlock, watchlist, share card, report content.
- README with setup, env vars, seed instructions, deploy steps. DECISIONS.md with every open call and the reasoning.

---

## 14. How to work

Build the whole thing. No scaffolding-only deliverable, no TODOs standing in for features, no lorem ipsum, no stubbed function with a comment describing what it would do. Real copy everywhere. If an external dependency blocks you, such as Instagram API access, implement the fallback and keep moving.

Before writing code, output a short plan: design tokens, ASCII wireframes for landing, brand page and review composer, and your milestone breakdown. Then build.
