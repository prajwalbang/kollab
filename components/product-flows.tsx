"use client";
import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { repo } from "@/lib/data/provider";
import { liveData } from "@/lib/data/mode";
import {
  dealTypes,
  followerBands,
  ghostStages,
  paymentStatuses,
  reviewInput,
  type Brand,
  type Session,
  type NewReview,
  type Review,
  type Aggregates,
  type RateRow,
  type RoomPost,
  type FollowerBand,
  type IdentityMode,
} from "@/lib/data/types";
import { ReviewCard } from "./kollab";
import { ContentSearch, useSearchQuery } from "./content-search";
import { searchItems } from "@/lib/data/search";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const appPath = (path: string) => `${basePath}${path}`;
const cats = [
  "Beauty",
  "Fashion",
  "Lifestyle",
  "Food & drink",
  "Tech",
  "Fitness",
];
const human = (s: string) => s.replaceAll("_", " ");
const money = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const bands = (s: string) => s.replaceAll("_", "–");
function ErrorText({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="form-error">
      {message}
    </p>
  ) : null;
}
function IdentityChoice({ profile, mode, onChange, consent, onConsent }: {
  profile: Session | null;
  mode: IdentityMode;
  onChange: (mode: IdentityMode) => void;
  consent: boolean;
  onConsent: (consent: boolean) => void;
}) {
  const mayAttribute = !!profile?.handle && (!liveData || profile.verified === true);
  return <fieldset className="identity-choice">
    <legend>How should this appear?</legend>
    <label><input type="radio" checked={mode === "anonymous"} onChange={() => { onChange("anonymous"); onConsent(false); }} />
      <span>Anonymous<small>Your Instagram handle stays private.</small></span></label>
    <label><input type="radio" checked={mode === "attributed"} disabled={!mayAttribute} onChange={() => { onChange("attributed"); onConsent(false); }} />
      <span>{mayAttribute ? `As @${profile.handle}` : "With my verified Instagram username"}<small>{mayAttribute ? "Your username will be visible to everyone." : "Verify Instagram in your account to use this option."}</small></span></label>
    {mode === "attributed" && <label className="identity-consent"><input type="checkbox" checked={consent} onChange={(e) => onConsent(e.target.checked)} />
      <span>I agree to publish my Instagram username with this contribution. Copies may remain public even if I remove it later.</span></label>}
  </fieldset>;
}
function Gate({
  session,
  onUnlock,
}: {
  session: Session | null;
  onUnlock: () => void;
}) {
  return (
    <div className="frosted-gate">
      <div className="frosted-shapes" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div>
        <span className="gate-lock">▣</span>
        <h3>
          {session
            ? "One collab unlocks the full picture."
            : "A little context goes a long way."}
        </h3>
        <p>
          {session
            ? liveData ? "An approved collaboration unlocks more reviews and rates. Complete Instagram verification in your account before submitting." : "Share your experience to see all reviews and rates."
            : "Sign in to read more. Contribute a collab to unlock rates."}
        </p>
        <button className="primary-button" onClick={onUnlock}>
          {session ? "Post your collab" : "Sign in to continue"}
        </button>
      </div>
    </div>
  );
}
export function ProfileSetup({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState("");
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await repo.updateProfile({
        alias: String(f.get("alias")),
        follower_band: String(f.get("band")) as FollowerBand,
        category: String(f.get("category")),
        city: String(f.get("city")) || null,
      });
      onDone();
    } catch {
      setError("Could not save your profile. Please try again.");
    }
  }
  return (
    <>
      <h2>Make yourself at home.</h2>
      <p>
        Your alias is for community discussions. Your Instagram handle only
        appears when you explicitly choose to publish it.
      </p>
      <form onSubmit={save}>
        <label>
          Choose an alias
          <input
            required
            name="alias"
            minLength={3}
            maxLength={30}
            defaultValue="Quiet Mango"
          />
        </label>
        <label>
          Follower band
          <select aria-label="Follower band" name="band" defaultValue="10k_25k">
            {followerBands.map((b) => (
              <option key={b} value={b}>
                {bands(b)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Your main category
          <select name="category">
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          City (private profile, optional)
          <select name="city">
            <option value="">Prefer not to say</option>
            <option>Mumbai</option>
            <option>Bangalore</option>
            <option>Delhi</option>
            <option>Hyderabad</option>
            <option>Chennai</option>
            <option>Pune</option>
          </select>
        </label>
        <ErrorText message={error} />
        <button className="primary-button full">
          Continue to your first collab →
        </button>
      </form>
    </>
  );
}
const freshReview = (): NewReview => ({
  identity_mode: "anonymous",
  attribution_consent: false,
  brand_id: "",
  agency_id: null,
  collab_month: new Date().toISOString().slice(0, 7),
  deal_type: "paid",
  cash_amount_inr: 0,
  product_claimed_value_inr: null,
  product_actual_value_inr: null,
  deliverables: {
    reels: 1,
    stories: 0,
    static_posts: 0,
    ugc_raw: 0,
    event_attendance: 0,
  },
  initial_offer_inr: null,
  final_amount_inr: 0,
  payment_status: "paid_on_time",
  days_to_payment: 15,
  ghost_stage: "none",
  usage_rights_requested: false,
  usage_rights_paid_separately: false,
  ran_as_paid_ad_without_payment: false,
  revisions_requested: 0,
  scope_creep: false,
  had_written_agreement: false,
  rating_communication: 3,
  rating_professionalism: 3,
  rating_payment: 3,
  would_work_again: true,
  body: null,
});
export function ReviewWizard({
  brand,
  onSelect,
  onAdd,
  onDone,
}: {
  brand: Brand | null;
  onSelect: (b: Brand | null) => void;
  onAdd: () => void;
  onDone: (b: Brand) => void;
}) {
  const [step, setStep] = useState(0),
    [draft, setDraft] = useState<NewReview>(freshReview),
    [q, setQ] = useState(""),
    [results, setResults] = useState<Brand[]>([]),
    [agencies, setAgencies] = useState<Brand[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [proof, setProof] = useState<{
      name: string;
      url: string;
      image: boolean;
      file: File;
    } | null>(null),
    [submitted, setSubmitted] = useState<Review | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [profile, setProfile] = useState<Session | null>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    let live = true;
    const t = setTimeout(
      () =>
        repo
          .searchBrands(q, 5)
          .then((bs) => live && setResults(bs))
          .catch(() => setError("Search failed. Please try again.")),
      200,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);
  useEffect(() => {
    repo
      .getSession()
      .then(setProfile)
      .catch(() => setError("Could not load your profile."));
    repo
      .searchBrands("")
      .then((bs) => setAgencies(bs.filter((b) => b.entity_type === "agency")))
      .catch(() => setError("Could not load agencies. Retry this form."));
  }, []);
  useEffect(
    () => () => {
      if (proof) URL.revokeObjectURL(proof.url);
    },
    [proof],
  );
  const set = <K extends keyof NewReview>(key: K, value: NewReview[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const titles = [
    "Who was the collab with?",
    "The deal, in numbers.",
    "What did you create?",
    "How did payment go?",
    "The working relationship.",
    "Anything else to add?",
    "Exactly what others will see.",
  ];
  const ready = () => {
    if (step === 0 && !brand) return "Choose a brand to continue.";
    if (step === 0 && draft.collab_month > new Date().toISOString().slice(0, 7))
      return "Choose the month of a completed collaboration.";
    if (step === 2 && !Object.values(draft.deliverables).some((n) => n > 0))
      return "Add at least one deliverable.";
    return "";
  };
  async function publish() {
    if (!brand) return;
    setBusy(true);
    setError("");
    try {
      if (liveData && !profile?.verified) throw new Error("Verify your Instagram account before submitting a review.");
      if (draft.identity_mode === "attributed" && !draft.attribution_consent) throw new Error("Confirm that you want your Instagram username to appear publicly.");
      const review = submitted || await repo.createReview({ ...draft, brand_id: brand.id });
      setSubmitted(review);
      if (liveData && proof) {
        const form = new FormData();
        form.set("review_id", review.id);
        form.set("file", proof.file);
        const response = await fetch(appPath("/api/proofs/"), { method: "POST", body: form });
        const result = await response.json();
        if (!response.ok) throw new Error(`Your review is saved for moderation, but the proof upload failed. ${result.error || "Retry the upload or continue without proof."}`);
      }
      onDone(brand);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not post your collab. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const preview: Review = {
    ...draft,
    brand_id: brand?.id || "",
    id: "preview",
    proof_status: "none",
    visibility: "published",
    trust_score: 0.5,
    helpful_count: 0,
    follower_band: profile?.follower_band || "10k_25k",
    category: profile?.category || brand?.category || "Beauty",
    region: null,
    reply: null,
    demo: false,
    attribution_handle: draft.identity_mode === "attributed" ? profile?.handle || null : null,
  };
  const toggle = (
    key:
      | "usage_rights_requested"
      | "usage_rights_paid_separately"
      | "ran_as_paid_ad_without_payment"
      | "scope_creep"
      | "had_written_agreement"
      | "would_work_again",
    label: string,
  ) => (
    <label className="toggle-row" key={key}>
      <span>{label}</span>
      <input
        type="checkbox"
        checked={draft[key]}
        onChange={(e) => set(key, e.target.checked)}
      />
    </label>
  );
  return (
    <>
      <div className="wizard-progress">
        <span>Post your collab</span>
        <span>{step + 1} of 7</span>
      </div>
      <div className="progress-track">
        <i style={{ width: `${((step + 1) / 7) * 100}%` }} />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={reduced ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: reduced ? 0 : 0.15 }}
        >
          <h2>{titles[step]}</h2>
          {step === 0 && (
            <>
              <p className="flow-intro">
                Your review stays anonymous. Start with the basics.
              </p>
              {brand ? (
                <div className="chosen-brand">
                  <b>{brand.name}</b>
                  <button onClick={() => onSelect(null)}>Change</button>
                </div>
              ) : (
                <div className="wizard-search">
                  <input
                    aria-label="Find brand"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search brand or @handle"
                  />
                  {results.map((b) => (
                    <button key={b.id} onClick={() => onSelect(b)}>
                      <span>
                        <b>{b.name}</b>
                        <small>
                          {b.category} · {b.entity_type} ·{" "}
                          {b.review_count || "No"} reviews
                        </small>
                      </span>
                      →
                    </button>
                  ))}
                  <button className="add-search" onClick={onAdd}>
                    ＋ Can’t find it? Add a brand
                  </button>
                </div>
              )}
              <label>
                Was an agency involved?
                <select
                  value={draft.agency_id || ""}
                  onChange={(e) => set("agency_id", e.target.value || null)}
                >
                  <option value="">No agency / worked directly</option>
                  {agencies
                    .filter((a) => a.id !== brand?.id)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Collaboration month
                <input
                  type="month"
                  value={draft.collab_month}
                  max={new Date().toISOString().slice(0, 7)}
                  onChange={(e) => set("collab_month", e.target.value)}
                />
              </label>
              <small className="form-footnote">
                Only the month is shared. We never show an exact collaboration
                date.
              </small>
            </>
          )}
          {step === 1 && (
            <>
              <label>Deal type</label>
              <div className="choice-grid">
                {dealTypes.map((d) => (
                  <button
                    key={d}
                    className={draft.deal_type === d ? "selected" : ""}
                    onClick={() => set("deal_type", d)}
                  >
                    {human(d)}
                  </button>
                ))}
              </div>
              <div className="form-row">
                <label>
                  Initial offer (₹)
                  <input
                    type="number"
                    min="0"
                    value={draft.initial_offer_inr ?? ""}
                    onChange={(e) =>
                      set(
                        "initial_offer_inr",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                    placeholder="Optional"
                  />
                </label>
                <label>
                  Final agreed cash (₹)
                  <input
                    type="number"
                    min="0"
                    value={draft.final_amount_inr}
                    onChange={(e) => {
                      set("final_amount_inr", Number(e.target.value));
                      set("cash_amount_inr", Number(e.target.value));
                    }}
                  />
                </label>
              </div>
              {["barter", "paid_plus_product"].includes(draft.deal_type) && (
                <div className="form-row">
                  <label>
                    Promised product value (₹)
                    <input
                      type="number"
                      min="0"
                      value={draft.product_claimed_value_inr ?? ""}
                      onChange={(e) =>
                        set(
                          "product_claimed_value_inr",
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                    />
                  </label>
                  <label>
                    Actual product value (₹)
                    <input
                      type="number"
                      min="0"
                      value={draft.product_actual_value_inr ?? ""}
                      onChange={(e) =>
                        set(
                          "product_actual_value_inr",
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                    />
                  </label>
                </div>
              )}
              <p className="flow-intro">
                Enter the cash amount agreed for this collaboration, excluding
                product value.
              </p>
            </>
          )}
          {step === 2 && (
            <>
              <p className="flow-intro">Tap to count what you delivered.</p>
              {Object.entries(draft.deliverables).map(([key, value]) => (
                <div className="stepper-row" key={key}>
                  <span>{human(key)}</span>
                  <div>
                    <button
                      aria-label={`Remove ${human(key)}`}
                      onClick={() =>
                        set("deliverables", {
                          ...draft.deliverables,
                          [key]: Math.max(0, value - 1),
                        })
                      }
                    >
                      −
                    </button>
                    <b>{value}</b>
                    <button
                      aria-label={`Add ${human(key)}`}
                      onClick={() =>
                        set("deliverables", {
                          ...draft.deliverables,
                          [key]: value + 1,
                        })
                      }
                    >
                      ＋
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
          {step === 3 && (
            <>
              <label>Payment outcome</label>
              <div className="choice-grid">
                {paymentStatuses.map((p) => (
                  <button
                    key={p}
                    className={draft.payment_status === p ? "selected" : ""}
                    onClick={() => {
                      set("payment_status", p);
                      if (["never_paid", "not_applicable"].includes(p))
                        set("days_to_payment", null);
                    }}
                  >
                    {human(p)}
                  </button>
                ))}
              </div>
              {!["never_paid", "not_applicable"].includes(
                draft.payment_status,
              ) && (
                <label>
                  Days from delivery to payment
                  <input
                    type="number"
                    min="0"
                    value={draft.days_to_payment ?? ""}
                    onChange={(e) =>
                      set(
                        "days_to_payment",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                  />
                </label>
              )}
              <label>
                Did communication stop?
                <select
                  value={draft.ghost_stage}
                  onChange={(e) =>
                    set(
                      "ghost_stage",
                      e.target.value as NewReview["ghost_stage"],
                    )
                  }
                >
                  {ghostStages.map((g) => (
                    <option value={g} key={g}>
                      {g === "none" ? "No, they stayed in touch" : human(g)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {step === 4 && (
            <>
              <div className="toggle-list">
                {toggle("had_written_agreement", "We had a written agreement")}
                {toggle(
                  "usage_rights_requested",
                  "They asked for usage rights",
                )}
                {toggle(
                  "usage_rights_paid_separately",
                  "Usage rights were paid separately",
                )}
                {toggle(
                  "ran_as_paid_ad_without_payment",
                  "They ran my content as an unpaid ad",
                )}
                {toggle("scope_creep", "The scope grew beyond our agreement")}
              </div>
              <label>
                Revision rounds
                <input
                  type="number"
                  min="0"
                  value={draft.revisions_requested}
                  onChange={(e) =>
                    set("revisions_requested", Number(e.target.value))
                  }
                />
              </label>
              {(
                [
                  "rating_communication",
                  "rating_professionalism",
                  "rating_payment",
                ] as const
              ).map((key) => (
                <div className="rating-row" key={key}>
                  <span>{human(key.replace("rating_", ""))}</span>
                  <div>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        aria-label={`${human(key)} ${n} of 5`}
                        key={n}
                        className={n <= draft[key] ? "selected" : ""}
                        onClick={() => set(key, n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {toggle("would_work_again", "I would work with them again")}
            </>
          )}
          {step === 5 && (
            <>
              <p className="flow-intro">
                Keep it first-hand. Describe the work, not individuals. No
                names, handles, or contact details.
              </p>
              <label>
                A note for other creators (optional)
                <textarea
                  rows={4}
                  maxLength={1200}
                  value={draft.body || ""}
                  onChange={(e) => set("body", e.target.value || null)}
                  placeholder="What would you have liked to know beforehand?"
                />
              </label>
              <small className="form-footnote">
                {draft.body?.length || 0}/1,200 characters
              </small>
              <label className="upload">
                {proof ? (
                  <>
                    {proof.image && (
                      <img src={proof.url} alt="Private proof preview" />
                    )}
                    <span>{proof.name}</span>
                  </>
                ) : (
                  <span>
                    ＋ Add private proof
                    <small>
                      {liveData ? "Optional · JPEG, PNG or WebP · up to 4 MB" : "Optional · image or PDF · stays in memory only"}
                    </small>
                  </span>
                )}
                <input
                  type="file"
                  accept={liveData ? "image/jpeg,image/png,image/webp" : "image/*,application/pdf"}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && liveData && (file.size > 4 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
                      setError("Choose a JPEG, PNG or WebP image no larger than 4 MB.");
                      return;
                    }
                    if (file)
                      setProof({
                        file,
                        name: file.name,
                        url: URL.createObjectURL(file),
                        image: file.type.startsWith("image/"),
                      });
                  }}
                />
              </label>
              {proof && (
                <button className="text-button" onClick={() => setProof(null)}>
                  Remove attachment
                </button>
              )}
              <small className="form-footnote">
                {liveData ? "Proof is private and available only for moderation. Redact names, contact details and financial identifiers before uploading. Uploading alone does not earn a verified badge." : "Demo proof is not uploaded or verified. It will not earn a verified badge."}
              </small>
              <label className="toggle-row">
                <span>I haven’t named or identified any individual.</span>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
              </label>
            </>
          )}
          {step === 6 && brand && (
            <>
              {!submitted && <IdentityChoice profile={profile} mode={draft.identity_mode || "anonymous"} onChange={(mode) => set("identity_mode", mode)} consent={!!draft.attribution_consent} onConsent={(consent) => set("attribution_consent", consent)} />}
              <p className="flow-intro">
                {draft.identity_mode === "attributed" ? `This review will show @${profile?.handle}.` : "This review will not show your name or Instagram handle."} Your exact date and private proof are not on this card.
              </p>
              <ReviewCard review={preview} brand={brand} />
              <small className="form-footnote">
                {liveData ? "Your review will be checked by a moderator before publication. An approved review unlocks rates." : "Proof stays private and is not uploaded in this demo."}
              </small>
            </>
          )}
        </motion.div>
      </AnimatePresence>
      <ErrorText message={error} />
      {submitted && liveData && <button className="outline-button" disabled={busy} onClick={() => brand && onDone(brand)}>Continue without proof</button>}
      <div className="wizard-actions">
        {step > 0 && !submitted ? (
          <button
            className="outline-button"
            onClick={() => {
              setStep(step - 1);
              setError("");
            }}
          >
            Back
          </button>
        ) : (
          <span />
        )}
        <button
          className="primary-button"
          disabled={busy || (step === 5 && !confirmed) || (step === 6 && draft.identity_mode === "attributed" && !draft.attribution_consent)}
          onClick={() => {
            const issue = ready();
            if (issue) {
              setError(issue);
              return;
            }
            if (step === 6) {
              publish();
              return;
            }
            if (step === 5) {
              const parsed = reviewInput.safeParse({
                ...draft,
                brand_id: brand?.id,
              });
              if (!parsed.success) {
                setError(parsed.error.issues[0].message);
                return;
              }
            }
            setError("");
            setStep(step + 1);
          }}
        >
          {busy ? "Saving…" : submitted ? "Retry proof upload" : step === 6 ? liveData ? "Submit for moderation" : "Post your collab" : "Continue →"}
        </button>
      </div>
    </>
  );
}
export function BrandContent({
  brand,
  session,
  version,
  onReview,
  onShare,
  initialReviews = [],
  initialAggregates = null,
}: {
  brand: Brand;
  session: Session | null;
  version: number;
  onReview: () => void;
  onShare: () => void;
  initialReviews?: Review[];
  initialAggregates?: Aggregates | null;
}) {
  const [tab, setTab] = useState("Overview"),
    [reviews, setReviews] = useState<Review[]>(initialReviews),
    [agg, setAgg] = useState<Aggregates | null>(initialAggregates),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [filters, setFilters] = useState({
      band: "",
      deal_type: "",
      year: "",
      category: "",
    });
  useEffect(() => {
    let live = true;
    setLoading(true);
    Promise.all([
      repo.getBrandAggregates(brand.id),
      repo.listReviews(brand.id, filters),
    ])
      .then(([a, r]) => {
        if (live) {
          setAgg(a);
          setReviews(r);
          setError("");
        }
      })
      .catch(() =>
        setError(
          "Could not load this brand. Try changing a filter or refresh.",
        ),
      )
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [brand.id, version, filters]);
  const limit = !session ? 1 : session.contributions ? Infinity : 3;
  return (
    <>
      <div className="brand-status">
        <span>
          {brand.is_claimed ? "✓ Claimed brand" : "Unclaimed profile"}
        </span>
        <button className="text-button" onClick={onShare}>
          Share scorecard ↗
        </button>
      </div>
      <section className="brand-scorecard">
        <div className="scorecard-lead">
          <span>Would work together again</span>
          <strong
            className={
              agg?.would_work_again === null
                ? "unknown-text"
                : (agg?.would_work_again || 0) >= 70
                  ? "good-text"
                  : (agg?.would_work_again || 0) >= 40
                    ? "caution-text"
                    : "bad-text"
            }
          >
            {loading
              ? "—"
              : agg?.would_work_again === null
                ? "Not enough data yet"
                : `${agg?.would_work_again}%`}
          </strong>
          <small>
            {agg?.count || 0} collaborations · weighted by review trust
          </small>
        </div>
        <div className="scorecard-grid">
          {[
            ["On-time payment", agg?.on_time_rate, "%"],
            ["Median time to pay", agg?.median_days_to_payment, " days"],
            ["Ghost rate", agg?.ghost_rate, "%"],
          ].map(([label, value, suffix]) => (
            <div key={String(label)}>
              <small>{label}</small>
              <b>
                {value === null || value === undefined
                  ? "Not enough data yet"
                  : `${value}${suffix}`}
              </b>
            </div>
          ))}
        </div>
        <p>
          {liveData ? 'Reputation percentages need at least 5 distinct creators. Payment amounts are available only through protected rate groups.' : 'At least 3 eligible reviews are needed for every statistic. Verified receipts carry more weight.'}
        </p>
      </section>
      <div className="brand-tabs">
        {["Overview", "Reviews", "Rates", "Discussion"].map((t) => (
          <button
            className={tab === t ? "active" : ""}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Rates" ? (
        <RatesExplorer
          category="All categories"
          setCategory={() => {}}
          session={session}
          version={version}
          onUnlock={onReview}
          onShare={onShare}
          brandId={brand.id}
        />
      ) : tab === "Discussion" ? (
        <Rooms
          session={session}
          version={version}
          onSignIn={onReview}
          roomKey={"brand:" + brand.id}
        />
      ) : (
        <>
          <div className="section-heading">
            <div>
              <h2>
                {tab === "Reviews"
                  ? "Creator reviews"
                  : "The collaboration record"}
              </h2>
              <p>
                {brand.demo
                  ? "Fictional sample reviews, for demonstration."
                  : "First-hand reports, shared anonymously or with a verified username."}
              </p>
            </div>
            <button className="primary-button" onClick={onReview}>
              Post your collab
            </button>
          </div>
          {tab === "Reviews" && (
            <div className="rate-filters">
              <select
                aria-label="Filter reviews by follower band"
                value={filters.band}
                onChange={(e) =>
                  setFilters({ ...filters, band: e.target.value })
                }
              >
                <option value="">All follower bands</option>
                {followerBands.map((b) => (
                  <option value={b} key={b}>
                    {bands(b)}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter reviews by category"
                value={filters.category}
                onChange={(e) =>
                  setFilters({ ...filters, category: e.target.value })
                }
              >
                <option value="">All categories</option>
                {cats.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select
                aria-label="Filter reviews by deal type"
                value={filters.deal_type}
                onChange={(e) =>
                  setFilters({ ...filters, deal_type: e.target.value })
                }
              >
                <option value="">All deal types</option>
                {dealTypes.map((d) => (
                  <option key={d} value={d}>
                    {human(d)}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter reviews by year"
                value={filters.year}
                onChange={(e) =>
                  setFilters({ ...filters, year: e.target.value })
                }
              >
                <option value="">All years</option>
                {["2026", "2025", "2024"].map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </div>
          )}
          <ErrorText message={error} />
          {loading && !reviews.length ? (
            <div className="skeleton" />
          ) : reviews.length ? (
            <div className="review-grid">
              {reviews.slice(0, limit).map((r) => (
                <ReviewCard key={r.id} brand={brand} review={r} />
              ))}
              {reviews.length > limit && (
                <Gate session={session} onUnlock={onReview} />
              )}
            </div>
          ) : (
            <div className="empty">
              <h3>No reviews in this view yet.</h3>
              <p>Share your first-hand experience or try a different filter.</p>
              <button className="primary-button" onClick={onReview}>
                Post your collab
              </button>
            </div>
          )}
          {tab === "Overview" && !liveData && (
            <div className="overview-detail">
              <h3>Payment behaviour over time</h3>
              <p>
                Monthly statistics appear once a month has at least 3 eligible
                reviews.
              </p>
              {[...new Set(reviews.map((r) => r.collab_month))].map((month) => (
                <div className="timeline-row" key={month}>
                  <b>{month}</b>
                  <span>
                    {reviews.filter((r) => r.collab_month === month).length}{" "}
                    reviews
                  </span>
                  <span>
                    {reviews.filter((r) => r.collab_month === month).length >= 3
                      ? "See the scorecard above for this sample"
                      : "Not enough data yet"}
                  </span>
                </div>
              ))}
              <h3>Agencies involved</h3>
              <p>
                {reviews.some((r) => r.agency_id)
                  ? "Agency-tagged reviews count toward both the brand and the agency profile."
                  : "No agency collaborations reported yet."}
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}
export function RatesExplorer({
  category,
  setCategory,
  session,
  version,
  onUnlock,
  onShare,
  brandId,
}: {
  category: string;
  setCategory: (c: string) => void;
  session: Session | null;
  version: number;
  onUnlock: () => void;
  onShare: () => void;
  brandId?: string;
}) {
  const [filters, setFilters] = useState({
      q: "",
      band: "",
      deal_type: "",
      city: "",
      deliverable: "",
    }),
    [rows, setRows] = useState<RateRow[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFilters({
      q: params.get("q") || "",
      band: params.get("band") || "",
      deal_type: params.get("deal_type") || "",
      city: params.get("city") || "",
      deliverable: params.get("deliverable") || "",
    });
  }, []);
  const rateQuery = useSearchQuery(filters.q);
  useEffect(() => {
    let live = true;
    if (liveData && !session?.contributions) { setRows([]); setLoading(false); setError(""); return; }
    setLoading(true);
    repo
      .getRates({
        ...filters,
        q: rateQuery,
        category: category === "All categories" ? undefined : category,
        brand_id: brandId,
      })
      .then((r) => {
        if (live) {
          setRows(r);
          setError("");
        }
      })
      .catch(() =>
        setError("Rates could not be loaded. Please change a filter to retry."),
      )
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [
    filters.band,
    filters.deal_type,
    filters.city,
    filters.deliverable,
    rateQuery,
    category,
    version,
    brandId,
    session?.contributions,
  ]);
  function update(key: string, value: string) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    const params = new URLSearchParams(
      Object.entries(next).filter(([, v]) => !!v),
    );
    window.history.replaceState(
      null,
      "",
      `${brandId ? window.location.pathname : appPath("/rates/" + encodeURIComponent(category))}${params.size ? "?" + params : ""}`,
    );
  }
  return (
    <section className="rates-page">
      <div className="section-heading">
        <div>
          <h1>Know what to ask for.</h1>
          <p>Real collaboration rates. Filter to find your context.</p>
        </div>
        <button className="text-button" onClick={onShare}>
          Share this view ↗
        </button>
      </div>
      <ContentSearch
        value={filters.q}
        onChange={(q) => update("q", q)}
        label="Search rates"
        placeholder={liveData ? "Search a brand, category, or deliverable…" : "Search a brand, category, city, or deliverable…"}
        count={session?.contributions && !loading ? rows.length : undefined}
        suggestions={liveData ? ["Beauty", "Reels", "Fashion"] : ["Beauty", "Reels", "Sunday Theory"]}
      />
      <div className="rate-filters">
        {!brandId && (
          <label>
            Category
            <select
              aria-label="Category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                window.history.replaceState(
                  null,
                  "",
                  appPath("/rates/" +
                    encodeURIComponent(e.target.value) +
                    window.location.search),
                );
              }}
            >
              <option>All categories</option>
              {cats.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          Follower band
          <select
            aria-label="Follower band"
            value={filters.band}
            onChange={(e) => update("band", e.target.value)}
          >
            <option value="">All bands</option>
            {followerBands.map((b) => (
              <option value={b} key={b}>
                {bands(b)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Deal type
          <select
            aria-label="Deal type"
            value={filters.deal_type}
            onChange={(e) => update("deal_type", e.target.value)}
          >
            <option value="">All deals</option>
            {dealTypes.map((d) => (
              <option value={d} key={d}>
                {human(d)}
              </option>
            ))}
          </select>
        </label>
        {!liveData && <label>
          City
          <select
            aria-label="City"
            value={filters.city}
            onChange={(e) => update("city", e.target.value)}
          >
            <option value="">All cities</option>
            <option>Mumbai</option>
            <option>Bangalore</option>
            <option>Delhi</option>
            <option>Pune</option>
          </select>
        </label>}
        <label>
          Deliverable
          <select
            aria-label="Deliverable"
            value={filters.deliverable}
            onChange={(e) => update("deliverable", e.target.value)}
          >
            <option value="">All deliverables</option>
            {[
              "reels",
              "stories",
              "static_posts",
              "ugc_raw",
              "event_attendance",
            ].map((d) => (
              <option value={d} key={d}>
                {human(d)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ErrorText message={error} />
      {!session?.contributions ? (
        <Gate session={session} onUnlock={onUnlock} />
      ) : loading ? (
        <div className="skeleton" />
      ) : (
        <>
          {!rows.length && (
            <div className="search-empty">
              <h3>No rates match this search.</h3>
              <p>
                Try another brand, category, or deliverable, or adjust your
                filters.
              </p>
              <button
                className="outline-button"
                onClick={() => update("q", "")}
              >
                Clear search
              </button>
            </div>
          )}
          <div className="rate-table">
            <div className="rate-table-head">
              <span>Category</span>
              <span>Median cash</span>
              <span>Reported range</span>
              <span>Sample</span>
            </div>
            {rows.map((r) => (
              <div className="rate-table-row" key={[r.category, r.band, r.deal_type, r.deliverable, r.brand_id].join(":")}>
                <b>{r.brand_name || r.category}{liveData && <small style={{display:'block',fontWeight:400}}>{[r.category,r.band?.replaceAll('_','–'),r.deliverable?.replaceAll('_',' '),r.deal_type?.replaceAll('_',' ')].filter(Boolean).join(' · ')}</small>}</b>
                <strong>
                  {r.median === null ? "Not enough data yet" : money(r.median)}
                </strong>
                <span>
                  {r.min === null ? "—" : money(r.min) + " – " + money(r.max!)}
                </span>
                <span>{liveData ? `At least ${r.count} creators` : `n = ${r.count}`}</span>
              </div>
            ))}
          </div>
          <p className="table-note">
            {liveData ? "Rates use fixed groups of at least 5 distinct creators. Amounts are rounded and sample sizes are shown in bands to protect privacy. Cash refers to the agreed amount, not payment received." : "Medians are weighted by review trust. Every filtered group needs at least 3 reviews. Demo rates reflect fictional collaborations; cash refers to the agreed amount, not payment received."}
          </p>
        </>
      )}
    </section>
  );
}
export function Rooms({
  session,
  version,
  onSignIn,
  roomKey,
}: {
  session: Session | null;
  version: number;
  onSignIn: () => void;
  roomKey?: string;
}) {
  const [category, setCategory] = useState(roomKey || "Beauty"),
    [posts, setPosts] = useState<RoomPost[]>([]),
    [body, setBody] = useState(""),
    [roomQuery, setRoomQuery] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [identityMode, setIdentityMode] = useState<IdentityMode>("anonymous"),
    [attributionConsent, setAttributionConsent] = useState(false),
    [message, setMessage] = useState("");
  const roomSearch = useSearchQuery(roomQuery);
  useEffect(() => {
    let active = true;
    setLoading(true);
    repo
      .listPosts(category, liveData ? roomSearch : undefined)
      .then((result) => { if (active) { setPosts(result); setError(""); } })
      .catch(() => active && setError("Could not load the room. Please try again."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [category, version, roomSearch]);
  const matchingPosts = searchItems(
    posts,
    roomSearch,
    (p) => `${p.body} ${p.category} ${p.comments.map((c) => c.body).join(" ")}`,
  );
  async function post(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (identityMode === "attributed" && !attributionConsent) throw new Error("Confirm public attribution before posting.");
      await repo.createPost(category, body, identityMode);
      setBody("");
      setIdentityMode("anonymous");
      setAttributionConsent(false);
      setMessage(liveData ? "Submitted for moderation. Your post will appear after approval." : "Your post is saved in this demo.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rooms-page">
      <h1>
        {roomKey ? "Brand discussion" : "A room for your kind of creator."}
      </h1>
      <p>Ask a question. Share a lesson. Choose how your own identity appears, and respect other people’s privacy.</p>
      {!roomKey && (
        <div className="category-tabs">
          {cats.map((c) => (
            <button
              className={c === category ? "selected" : ""}
              onClick={() => setCategory(c)}
              key={c}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      <ContentSearch
        value={roomQuery}
        onChange={setRoomQuery}
        label="Search discussions"
        placeholder="Search opinions, questions, and replies in this room…"
        count={matchingPosts.length}
        suggestions={["Usage rights", "Payment", "Revisions"]}
      />
      {session && (!liveData || session.verified) ? (
        <form className="room-composer" onSubmit={post}>
          <label htmlFor="room-post">Your experience</label>
          <textarea
            id="room-post"
            required
            minLength={10}
            maxLength={1200}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What’s on your mind? Avoid names and personal details."
          />
          <IdentityChoice profile={session} mode={identityMode} onChange={setIdentityMode} consent={attributionConsent} onConsent={setAttributionConsent} />
          <button disabled={busy || (identityMode === "attributed" && !attributionConsent)} className="primary-button">
            {busy ? "Posting…" : liveData ? "Submit to the room" : "Post to the room"}
          </button>
        </form>
      ) : (
        <button className="outline-button" onClick={onSignIn}>
          {session ? "Verify Instagram to join the conversation" : "Sign in to join the conversation"}
        </button>
      )}
      <ErrorText message={error} />
      {message && <p role="status">{message}</p>}
      {loading && !posts.length ? (
        <div className="skeleton" />
      ) : !matchingPosts.length ? (
        <div className="empty">
          <h3>
            {roomSearch
              ? "No discussions match your search."
              : "Start the conversation."}
          </h3>
          <p>
            {roomSearch
              ? "Try another topic or choose a different room."
              : "No posts here yet. Ask about briefs, usage rights, or getting paid."}
          </p>
        </div>
      ) : (
        matchingPosts.map((p) => (
          <RoomCard key={p.id} post={p} session={session} onSignIn={onSignIn} />
        ))
      )}
    </section>
  );
}
function RoomCard({
  post,
  session,
  onSignIn,
}: {
  post: RoomPost;
  session: Session | null;
  onSignIn: () => void;
}) {
  const [comment, setComment] = useState(""),
    [error, setError] = useState(""),
    [report, setReport] = useState(false),
    [voted, setVoted] = useState(false),
    [busy, setBusy] = useState(false),
    [identityMode, setIdentityMode] = useState<IdentityMode>("anonymous"),
    [attributionConsent, setAttributionConsent] = useState(false),
    [message, setMessage] = useState("");
  return (
    <article className="room-card">
      <small>{post.identity_mode === "attributed" && post.attribution_handle ? `@${post.attribution_handle} · verified creator` : `${post.alias || "Anonymous creator"} · anonymous community member`}</small>
      <p>{post.body}</p>
      <div className="room-actions">
        <button
          onClick={async () => {
            if (!session) {
              onSignIn();
              return;
            }
            try {
              setVoted(await repo.vote(post.id));
            } catch {
              setError("Could not save your vote.");
            }
          }}
        >
          {voted ? "✓ " : ""}Helpful · {post.helpful_count}
        </button>
        <button onClick={() => setReport(true)}>Report</button>
      </div>
      {post.comments.map((c) => (
        <div className="comment" key={c.id}>
          <small>{c.identity_mode === "attributed" && c.attribution_handle ? `@${c.attribution_handle}` : c.alias || "Anonymous creator"}</small>
          <p>{c.body}</p>
        </div>
      ))}
      {session && (!liveData || session.verified) && (
        <form
          className="comment-form identity-comment-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true); setError(""); setMessage("");
            try {
              if (identityMode === "attributed" && !attributionConsent) throw new Error("Confirm public attribution before replying.");
              await repo.comment(post.id, comment, identityMode);
              setComment("");
              setIdentityMode("anonymous"); setAttributionConsent(false);
              setMessage(liveData ? "Your reply is awaiting moderation." : "Reply saved.");
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Could not add comment.",
              );
            } finally { setBusy(false); }
          }}
        >
          <input
            aria-label="Write a comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a helpful reply"
            required
            maxLength={1200}
          />
          <IdentityChoice profile={session} mode={identityMode} onChange={setIdentityMode} consent={attributionConsent} onConsent={setAttributionConsent} />
          <button disabled={busy || (identityMode === "attributed" && !attributionConsent)}>{busy ? "Saving…" : "Reply →"}</button>
        </form>
      )}
      <ErrorText message={error} />
      {message && <p role="status">{message}</p>}
      {report && (
        <ReportDialog targetId={post.id} onClose={() => setReport(false)} />
      )}
    </article>
  );
}
export function ReportDialog({
  targetId,
  onClose,
}: {
  targetId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("Personal or identifying information"),
    [done, setDone] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="report-panel" role="dialog" aria-label="Report content">
      <button
        className="report-close"
        aria-label="Close report"
        onClick={onClose}
      >
        ×
      </button>
      <h3>{done ? "Report saved" : "Report this content"}</h3>
      {done ? (
        <p>
          {liveData ? "Your report has been sent to the moderation queue. Thank you for helping keep Kollab useful." : "Your report is saved locally for this demo. A live moderation team is not connected."}
        </p>
      ) : (
        <>
          <select
            aria-label="Report reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {[
              "Personal or identifying information",
              "Not a first-hand experience",
              "Harassment or abuse",
              "Misleading information",
              "Other concern",
            ].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <ErrorText message={error} />
          <button
            className="primary-button"
            onClick={() =>
              repo
                .report(targetId, reason)
                .then(() => setDone(true))
                .catch(() =>
                  setError("Could not save report. Please try again."),
                )
            }
          >
            Send report
          </button>
        </>
      )}
    </div>
  );
}
export function ShareCard({
  brand,
  aggregates,
  category,
}: {
  brand: Brand | null;
  aggregates: Aggregates | null;
  category: string;
}) {
  const [copied, setCopied] = useState(false),
    [error, setError] = useState(""),
    [rate, setRate] = useState<RateRow | null>(null);
  useEffect(() => {
    if (!brand) {
      const params = Object.fromEntries(
        new URLSearchParams(window.location.search),
      );
      repo
        .getSession()
        .then((session) =>
          session?.contributions
            ? repo.getRates({
                ...params,
                category: category === "All categories" ? undefined : category,
              })
            : [],
        )
        .then((rs) =>
          setRate(rs.find((r) => r.median !== null) || rs[0] || null),
        )
        .catch(() => setError("Could not prepare the rate card."));
    }
  }, [brand, category]);
  const title = brand?.name || `${rate?.category || category} rates`;
  const value = brand
    ? aggregates?.would_work_again === null
      ? "Not enough data yet"
      : `${aggregates?.would_work_again ?? "—"}%`
    : rate?.median
      ? money(rate.median)
      : "Not enough data yet";
  const sample = brand ? aggregates?.count : rate?.count;
  return (
    <>
      <h2>Send a little context.</h2>
      <p>A clean card for your creator group chat.</p>
      <div className="share-card">
        <span className="share-wordmark">kollab.</span>
        <h3>{title}</h3>
        <small>
          {brand
            ? "Would work together again"
            : "Median agreed cash per collaboration"}
        </small>
        <strong>{value}</strong>
        <p>
          {sample || 0} reviews ·{" "}
          {!liveData && (brand?.demo || !brand)
            ? "Includes fictional demo data"
            : "Creator reported"}
        </p>
        <footer>Check a brand before you sign.</footer>
      </div>
      <ErrorText message={error} />
      <div className="share-actions">
        <button
          className="primary-button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              setCopied(true);
            } catch {
              setError(
                "Copy is unavailable. Select the URL below to share it.",
              );
            }
          }}
        >
          {copied ? "Link copied" : "Copy share link"}
        </button>
        <button
          className="outline-button"
          onClick={async () => {
            try {
              if (navigator.share)
                await navigator.share({
                  title: "Kollab · " + title,
                  text: `${title}: ${value} · ${sample || 0} reviews`,
                  url: window.location.href,
                });
              else window.print();
            } catch (e) {
              if (!(e instanceof DOMException && e.name === "AbortError"))
                setError("Sharing is unavailable. Copy the link instead.");
            }
          }}
        >
          Share card ↗
        </button>
      </div>
      <input
        aria-label="Share URL"
        className="share-url"
        readOnly
        value={typeof window === "undefined" ? "" : window.location.href}
      />
      <small className="form-footnote">
        Screenshot this card for WhatsApp. Web sharing uses your device’s share
        sheet.
      </small>
    </>
  );
}
