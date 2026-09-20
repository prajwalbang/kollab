# Implementation decisions

- The front-end override takes precedence over the main build brief. No backend, auth provider, database, email service, moderation console, instrumentation, SEO work, or deployment configuration is included.
- The main brief arrived during implementation. The initial warm editorial concept was replaced with the prescribed cool translucent material system, blue interaction color, Geist typography, structured review wizard, and contribution gates.
- The exact explicitly enumerated records are represented as `User`, `BrandRecord`, `CollabReview`, and `ReviewProof`. Public `Brand` and `Review` projections omit private identity fields and add presentation metadata. Supplementary table shapes are minimal where the main brief lists a table without a schema.
- Local fixtures and localStorage simulate the repository; local data is not a security boundary. Real auth, moderation, proof storage, private queries, authorization, dedupe constraints, and aggregate enforcement must run server-side in production.
- Public review projections omit user IDs, exact timestamps, encrypted handles, and private proof objects. We expose the collaboration month and follower band only. Narrow aggregate groups and groups with fewer than three eligible values remain suppressed.
- Weights: verified proof = 2, established fixture review = 1, a newly simulated account = 0.5. Percentages use weighted counts; cash/product/payment medians use a weighted median. We conservatively require three non-null observations for a metric. New demo account reviews remain lower-weight for the demo session; real account aging belongs in the backend.
- The four sample reviews are attached only to Sunday Theory and Peach Club, both marked fictional. Three Sunday Theory reviews cover on-time pay, slow pay, and ghosting after posting. The second brand has one review, demonstrating suppressed aggregates. No real brand gets a fabricated review.
- Local proof files use object URLs, are never uploaded, are released after preview, and never automatically earn a receipts-verified badge.
- Logged-out users see one full review; noncontributors see three; contributors see all reviews and rates. Locked areas contain nonsemantic placeholder shapes under blur and a white scrim, so hidden text cannot be recovered from the DOM or screenshots of those areas. The demo fixture bundle itself is public by design.
- Rate URLs preserve filters. The UI provides a screenshot-ready card, clipboard URL, and native share sheet / print fallback. Shortlink infrastructure and generated OG images require services excluded from this pass.
- Instagram and bio-code verification are explicitly simulated. The toolbar can force either verification path to fail. No credential is sent outside the app.
- Notifications are generated locally when new reviews land on watched brands. No real email or digest is sent. Reports save locally and clearly acknowledge that no live moderator is connected.
- Content checks reject contact details, handles, and common abusive terms; the composer also requires an explicit confirmation that individuals were not identified. This is a demo pre-publish check, not production-grade name detection or legal review.
- Local dark-mode preference persists separately from demo data. Reduced transparency removes glass effects; reduced motion disables animation. Main UI is mobile-first, with bottom navigation and review sheets.
- Geist is self-hosted from the installed Next.js distribution, avoiding runtime font network requests.
- Production builds use Next.js's supported webpack option because Turbopack process creation was restricted in the build sandbox. Development uses the standard Next.js dev command.

## User-directed glass restyle

The supplied visual reference established the floating glass navigation, white active pill, and soft translucent material system. Search is available directly from the navigation. A later visual direction replaced the woodland scene with the permanent light wordmark backdrop described below. Surfaces share one glass material family and retain solid reduced-transparency fallbacks.

## Opinion search and expanded reviews

Community search matches review text, brand names, categories, and collaboration outcomes. Every keyword must match; longer words allow typo tolerance while short terms use prefix matching to avoid conflating “late” and “date”. Search preserves the original contribution gate rather than reindexing results into unlocked positions. Rates search runs inside the repository before computing aggregates, retains the n=3 rule for the resulting sample, and persists `q` alongside other URL filters. Rooms search includes discussion bodies and replies within the selected room; Saved searches only bookmarked brands.

Review cards now open a portalled, centered dialog that springs from the clicked card’s actual screen position. The expanded view uses only the existing public review projection, adds no identity/proof exposure, traps keyboard focus, restores scroll and focus on close, and honors reduced motion. Fictional fixture narratives have been extended consistently with their structured values. The backdrop now uses locally rendered mist-covered ridges instead of the earlier angular trees.

## White brand backdrop

The landscape was replaced with a large centered yellow `kollab.` wordmark, softened beneath a translucent layer. A later direction made the light treatment permanent: there is no theme state, preference, or switch. The background is decorative, fixed, locally rendered in Geist, ignored by assistive technology, and hidden for reduced-transparency preferences and printing.

## Permanent light mode and mobile navigation

Kollab now renders with `data-theme="light"` at the document root. Mobile no longer compresses the desktop navigation or hides destinations. The top capsule becomes a utility bar for search, notifications, and account access, while a five-item bottom capsule exposes Discover, Reviews, Rooms, Rates, and Saved at 320px and above. Brand results use a single readable column on mobile, key controls keep touch-sized targets, and call-to-action layouts expand to the available width.
