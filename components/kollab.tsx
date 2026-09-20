"use client";
import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type FormEvent,
} from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import Link from "next/link";
import { createPortal } from "react-dom";
import { ContentSearch, useSearchQuery } from "./content-search";
import { ReviewDetail, type CardOrigin } from "./review-detail";
import { searchItems } from "@/lib/data/search";
import {
  ReviewWizard,
  RatesExplorer,
  Rooms,
  ShareCard,
  ReportDialog,
  ProfileSetup,
  BrandContent,
} from "./product-flows";
import { repo } from "@/lib/data/provider";
import {
  brandInput,
  type Brand,
  type Review,
  type Session,
  type Aggregates,
  type Notification,
} from "@/lib/data/types";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const appPath = (path: string) => `${basePath}${path}`;
const withoutBasePath = (path: string) =>
  basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ),
    arrow: (
      <>
        <path d="M4 12h15m-6-6 6 6-6 6" />
      </>
    ),
    bookmark: <path d="M6 4h12v17l-6-4-6 4z" />,
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19V5m0 14h17M8 15v-4m5 4V7m5 8v-6" />
      </>
    ),
    heart: (
      <path d="M20 5c-3-3-6 0-8 2-2-2-5-5-8-2-5 5 8 15 8 15s13-10 8-15Z" />
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    bell: (
      <>
        <path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 8H3c0-1 3-1 3-8m6 11h0" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m8 5 7 7-7 7" />,
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m3 10v-3a6 6 0 0 0-2-4" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3m4 5v2" />
      </>
    ),
    instagram: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <path d="M17 7h.01" />
      </>
    ),
    edit: (
      <>
        <path d="m15 4 5 5-11 11H4v-5zM12 7l5 5" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.arrow}
    </svg>
  );
}
const categories = [
  "All categories",
  "Beauty",
  "Fashion",
  "Lifestyle",
  "Food & drink",
  "Tech",
  "Fitness",
];
const money = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
function BrandLogo({
  brand,
  small = false,
}: {
  brand: Brand;
  small?: boolean;
}) {
  return (
    <div
      className={"brand-logo " + (small ? "small" : "")}
      style={{ background: brand.color }}
    >
      {brand.name === "Nykaa" ? (
        <span className="nykaa">NYKAA</span>
      ) : brand.name === "boAt" ? (
        <span className="boat">
          bo<span>A</span>t
        </span>
      ) : brand.name === "Mamaearth" ? (
        <span className="mama">mamaearth</span>
      ) : brand.name === "The Souled Store" ? (
        <span className="souled">
          the
          <br />
          souled
          <br />
          store
        </span>
      ) : brand.name === "Dot & Key" ? (
        <span className="dotkey">Dot & Key</span>
      ) : brand.name === "Myntra" ? (
        <span className="myntra">M</span>
      ) : (
        brand.name
          .split(" ")
          .map((s) => s[0])
          .slice(0, 2)
          .join("")
      )}
    </div>
  );
}
function SearchBox({
  onChoose,
  onAdd,
  large = false,
}: {
  onChoose: (b: Brand) => void;
  onAdd: () => void;
  large?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true;
    setLoading(true);
    const t = setTimeout(
      () =>
        repo
          .searchBrands(q, 5)
          .then((bs) => {
            if (live) {
              setResults(bs);
              setError("");
            }
          })
          .catch(
            () => live && setError("Search is unavailable. Please try again."),
          )
          .finally(() => live && setLoading(false)),
      200,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div ref={ref} className={"search-wrap " + (large ? "large" : "")}>
      <div className="search-input">
        <Icon name="search" />
        <input
          aria-label="Search brands and agencies"
          placeholder={
            large
              ? "Search a brand, agency, or @handle"
              : "Search brands or @handles"
          }
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter" && results[0]) {
              onChoose(results[0]);
              setOpen(false);
            }
          }}
        />
        {large ? (
          <button
            className="search-go"
            aria-label="Show search results"
            onClick={() => setOpen(!open)}
          >
            <Icon name="arrow" />
          </button>
        ) : (
          <kbd>⌘ K</kbd>
        )}
      </div>
      {open && (
        <div className="search-results">
          {loading ? (
            <p>Finding your next collaboration…</p>
          ) : error ? (
            <p role="alert">{error}</p>
          ) : results.length ? (
            results.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  onChoose(b);
                  setOpen(false);
                }}
              >
                <BrandLogo brand={b} small />
                <span>
                  <b>{b.name}</b>
                  <small>
                    {b.category} · {b.entity_type} ·{" "}
                    {b.review_count
                      ? `${b.review_count} reviews`
                      : "no reviews yet"}
                  </small>
                </span>
                <Icon name="chevron" size={16} />
              </button>
            ))
          ) : (
            <p>No brands found. Be the first to add one.</p>
          )}
          <button
            className="add-search"
            onClick={() => {
              setOpen(false);
              onAdd();
            }}
          >
            <Icon name="plus" />
            Can’t find it? Add a brand
          </button>
        </div>
      )}
    </div>
  );
}
export default function Kollab({
  initialSlug,
  initialTab = "discover",
  initialCategory = "All categories",
}: {
  initialSlug?: string;
  initialTab?: string;
  initialCategory?: string;
}) {
  const [tab, setTab] = useState(initialTab),
    [category, setCategory] = useState(initialCategory),
    [entity, setEntity] = useState("all"),
    [brands, setBrands] = useState<Brand[]>([]),
    [reviews, setReviews] = useState<Review[]>([]),
    [saved, setSaved] = useState<Brand[]>([]),
    [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0),
    [modal, setModal] = useState<
      "review" | "add" | "auth" | "about" | "share" | "profile" | null
    >(null),
    [selected, setSelected] = useState<Brand | null>(null),
    [detail, setDetail] = useState<Brand | null>(null),
    [aggregates, setAggregates] = useState<Aggregates | null>(null),
    [toast, setToast] = useState(""),
    [notifications, setNotifications] = useState(false),
    [forceFail, setForceFail] = useState(false),
    [expanded, setExpanded] = useState(false),
    [sort, setSort] = useState("popular"),
    [notices, setNotices] = useState<Notification[]>([]),
    [navSearch, setNavSearch] = useState(false),
    [communityQuery, setCommunityQuery] = useState(""),
    [savedQuery, setSavedQuery] = useState(""),
    [reviewIntent, setReviewIntent] = useState(false),
    [previewAggregates, setPreviewAggregates] = useState<Aggregates | null>(
      null,
    );
  useEffect(() => {
    const update = () => setVersion((v) => v + 1);
    window.addEventListener("kollab-change", update);
    return () => window.removeEventListener("kollab-change", update);
  }, []);
  useEffect(() => {
    let live = true;
    Promise.all([
      repo.searchBrands(""),
      repo.listReviews(),
      repo.getWatchlist(),
      repo.getSession(),
      repo.getNotifications(),
      repo.getBrandAggregates("demo-1"),
    ])
      .then(([bs, rs, ws, s, ns, pa]) => {
        if (live) {
          setBrands(bs);
          setReviews(rs);
          setSaved(ws);
          setSession(s);
          setNotices(ns);
          setPreviewAggregates(pa);
          setError("");
        }
      })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [version]);
  useEffect(() => {
    if (initialSlug)
      repo
        .getBrand(initialSlug)
        .then((b) => {
          setDetail(b);
          if (!b) setError("This brand could not be found.");
        })
        .catch(() => setError("Unable to load this brand."));
  }, [initialSlug]);
  useEffect(() => {
    if (detail) {
      setAggregates(null);
      repo
        .getBrandAggregates(detail.id)
        .then(setAggregates)
        .catch(() => setError("Unable to load brand statistics."));
    }
  }, [detail, version]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!modal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
      if (e.key === "Tab") {
        const dialog = document.querySelector(".modal");
        const focusables = dialog?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input, select, textarea, a[href]",
        );
        if (focusables?.length) {
          const first = focusables[0],
            last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", handler);
    };
  }, [modal]);
  useEffect(() => {
    const pop = () => {
      const slug = withoutBasePath(window.location.pathname).match(
        /^\/(brand|agency)\/(.+)$/,
      )?.[2];
      if (slug) repo.getBrand(slug).then(setDetail);
      else setDetail(null);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const navigate = (t: string) => {
    setTab(t);
    setDetail(null);
    window.history.pushState(
      null,
      "",
      appPath(t === "rates" ? "/rates/All%20categories" : "/"),
    );
  };
  const choose = (b: Brand) => {
    setDetail(b);
    setTab("discover");
    window.history.pushState(
      null,
      "",
      appPath(`/${b.entity_type}/${b.slug}`),
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const startReview = (b?: Brand) => {
    setSelected(b || null);
    setReviewIntent(true);
    setModal(session ? "review" : "auth");
  };
  const toggle = async (b: Brand) => {
    try {
      const active = await repo.toggleWatchlist(b.id);
      setToast(
        active
          ? `${b.name} added to your watchlist`
          : `${b.name} removed from your watchlist`,
      );
    } catch {
      setToast("Could not update watchlist. Please try again.");
    }
  };
  const opinionQuery = useSearchQuery(communityQuery);
  const watchQuery = useSearchQuery(savedQuery);
  const communityMatches = searchItems(
    reviews,
    opinionQuery,
    (r) =>
      `${brands.find((b) => b.id === r.brand_id)?.name || ""} ${r.body || ""} ${r.category} ${r.deal_type} ${r.payment_status} ${r.payment_status === "paid_late" ? "late payment slow payer" : r.payment_status === "paid_on_time" ? "on time payment" : ""} ${r.ghost_stage !== "none" ? "ghosted ghosting" : ""} ${r.usage_rights_requested ? "usage rights" : ""}`,
  );
  const filtered = searchItems(
    tab === "watchlist" ? saved : brands,
    tab === "watchlist" ? watchQuery : "",
    (b) => `${b.name} ${b.instagram_handle} ${b.category} ${b.entity_type}`,
  )
    .filter(
      (b) =>
        (category === "All categories" || b.category === category) &&
        (entity === "all" || b.entity_type === entity),
    )
    .sort((a, b) =>
      sort === "az"
        ? a.name.localeCompare(b.name)
        : sort === "reviewed"
          ? (b.review_count || 0) - (a.review_count || 0)
          : 0,
    );

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <div className="glass-masthead">
          <Link href="/" className="wordmark">
            kollab<span className="logo-dot">.</span>
          </Link>
          <span>The creator’s inside word</span>
          <button onClick={() => startReview()}>
            Share your experience <Icon name="arrow" size={16} />
          </button>
        </div>
        <div className="main-shell">
          <header className="topbar">
            <nav className="glass-nav" aria-label="Main navigation">
              {[
                ["discover", "Discover"],
                ["reviews", "Reviews"],
                ["rates", "Rates"],
                ["rooms", "Rooms"],
                ["watchlist", "Saved"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={tab === id ? "active" : ""}
                  aria-current={tab === id ? "page" : undefined}
                  onClick={() => navigate(id)}
                >
                  {label}
                  {id === "watchlist" && saved.length > 0 && (
                    <span>{saved.length}</span>
                  )}
                </button>
              ))}
            </nav>
            <div className="top-actions">
              <button
                className="icon-button nav-search"
                aria-label="Search brands"
                aria-expanded={navSearch}
                onClick={() => setNavSearch(!navSearch)}
              >
                <Icon name="search" size={24} />
              </button>
              <span className="india">
                <span /> Built for Indian creators
              </span>
              <div className="notification-wrap">
                <button
                  className="icon-button"
                  aria-label="Notifications"
                  onClick={() => setNotifications(!notifications)}
                >
                  <Icon name="bell" />
                </button>
                {notifications && (
                  <div className="notifications">
                    <b>
                      {notices.some((n) => !n.read)
                        ? "Watchlist updates"
                        : "You’re all caught up"}
                    </b>
                    {notices.length ? (
                      notices.map((n) => (
                        <button
                          className="notice-item"
                          key={n.id}
                          onClick={() => {
                            const b = brands.find((b) => b.id === n.brand_id);
                            if (b) choose(b);
                            setNotifications(false);
                          }}
                        >
                          {!n.read ? "● " : ""}
                          {n.message}
                        </button>
                      ))
                    ) : (
                      <p>Follow brands to see new reviews here.</p>
                    )}
                    <button onClick={() => repo.markNotificationsRead()}>
                      Mark all as read
                    </button>
                    <small>Local demo notifications</small>
                  </div>
                )}
              </div>
              <button className="signin" onClick={() => setModal("auth")}>
                {session ? session.alias : "Sign in"}
                <Icon name="users" size={16} />
              </button>
            </div>
            {navSearch && (
              <div className="nav-search-panel">
                <SearchBox
                  onChoose={(b) => {
                    choose(b);
                    setNavSearch(false);
                  }}
                  onAdd={() => {
                    setModal("add");
                    setNavSearch(false);
                  }}
                />
              </div>
            )}
          </header>
          <main>
            {detail ? (
              <>
                <button
                  className="back-link"
                  onClick={() => {
                    setDetail(null);
                    window.history.pushState(null, "", appPath("/"));
                  }}
                >
                  ← Back to discovery
                </button>
                <section className="detail-head">
                  <BrandLogo brand={detail} />
                  <div>
                    <div className="eyebrow">
                      {detail.category} · {detail.entity_type}
                      {detail.demo ? " · FICTIONAL DEMO BRAND" : ""}
                    </div>
                    <h1>{detail.name}</h1>
                    <p>@{detail.instagram_handle}</p>
                  </div>
                  <button
                    className="outline-button"
                    onClick={() => toggle(detail)}
                  >
                    <Icon name="bookmark" />
                    {saved.some((b) => b.id === detail.id)
                      ? "Saved"
                      : "Save brand"}
                  </button>
                </section>
                <BrandContent
                  brand={detail}
                  session={session}
                  version={version}
                  onReview={() => startReview(detail)}
                  onShare={() => setModal("share")}
                />
              </>
            ) : (
              <>
                {tab === "discover" && (
                  <section className="hero">
                    <div className="hero-copy">
                      <div className="launch-tag">
                        <span /> Built for your next brand DM
                      </div>
                      <h1>
                        Check a brand
                        <br />
                        before you sign<span>.</span>
                      </h1>
                      <p>
                        What they pay. How they behave. From creators who’ve
                        worked with them.
                      </p>
                      <SearchBox
                        large
                        onChoose={choose}
                        onAdd={() => setModal("add")}
                      />
                      <div className="hero-trust">
                        <Icon name="shield" size={15} />
                        <span>Verified creators. Anonymous experiences.</span>
                      </div>
                    </div>
                    <div className="hero-art product-preview">
                      <div className="preview-heading">
                        <span>Sunday Theory</span>
                        <span className="demo-tag">Fictional demo</span>
                      </div>
                      <p>Would work together again</p>
                      <strong>
                        {previewAggregates?.would_work_again ?? "—"}
                        <span>%</span>
                      </strong>
                      <div className="preview-meter">
                        <i
                          style={{
                            width: `${previewAggregates?.would_work_again || 0}%`,
                          }}
                        />
                      </div>
                      <div className="preview-metrics">
                        <div>
                          <b>{previewAggregates?.on_time_rate ?? "—"}%</b>
                          <small>On-time payment</small>
                        </div>
                        <div>
                          <b>{previewAggregates?.ghost_rate ?? "—"}%</b>
                          <small>Ghost rate</small>
                        </div>
                      </div>
                      <div className="preview-caption">
                        {previewAggregates?.count || 0} collabs · proof-weighted
                        · demo data
                      </div>
                      <button
                        onClick={() => {
                          const b = brands.find((b) => b.id === "demo-1");
                          if (b) choose(b);
                        }}
                      >
                        See the full picture <Icon name="arrow" size={17} />
                      </button>
                    </div>
                  </section>
                )}
                {tab === "discover" && (
                  <div className="trust-strip">
                    <span>
                      <Icon name="shield" size={18} />
                      <b>Your identity stays yours</b>
                    </span>
                    <span>
                      <Icon name="users" size={18} />
                      <b>By creators, for creators</b>
                    </span>
                    <span>
                      <Icon name="chart" size={18} />
                      <b>Real experiences. Real clarity.</b>
                    </span>
                    <span className="trust-end">
                      No brand-sponsored rankings. Ever.
                    </span>
                  </div>
                )}
                {tab === "discover" && reviews.length > 0 && (
                  <div className="activity-strip">
                    <span className="activity-dot" />
                    <span>
                      <b>Demo community activity</b> · A{" "}
                      {reviews[0].follower_band.replaceAll("_", "–")}{" "}
                      {reviews[0].category.toLowerCase()} creator reported{" "}
                      {reviews[0].payment_status.replaceAll("_", " ")}.
                    </span>
                    <button onClick={() => navigate("reviews")}>
                      Read the report ↗
                    </button>
                  </div>
                )}
                {(tab === "discover" || tab === "watchlist") && (
                  <section className="directory">
                    <div className="section-heading">
                      <div>
                        <div className="eyebrow">
                          {tab === "watchlist"
                            ? "Saved for later"
                            : "The directory"}
                        </div>
                        <h2>
                          {tab === "watchlist"
                            ? "Your watchlist"
                            : "Know who you’re working with"}
                          <span className="heading-dot">.</span>
                        </h2>
                        <p>
                          {tab === "watchlist"
                            ? "Your saved brands, all in one place."
                            : "Real brands. First-hand experiences. Start with beauty & skincare."}
                        </p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => setModal("add")}
                      >
                        <Icon name="plus" size={17} /> Add a brand
                      </button>
                    </div>
                    {tab === "watchlist" && (
                      <ContentSearch
                        value={savedQuery}
                        onChange={setSavedQuery}
                        label="Search saved brands"
                        placeholder="Find a saved brand, @handle, or category…"
                        count={filtered.length}
                      />
                    )}
                    <div className="filter-row">
                      <div className="category-tabs">
                        {categories.map((c) => (
                          <button
                            key={c}
                            onClick={() => {
                              setCategory(c);
                              setExpanded(false);
                            }}
                            className={category === c ? "selected" : ""}
                          >
                            {c === "All categories" && (
                              <Icon name="grid" size={14} />
                            )}{" "}
                            {c}
                          </button>
                        ))}
                      </div>
                      <select
                        aria-label="Brand or agency"
                        value={entity}
                        onChange={(e) => setEntity(e.target.value)}
                      >
                        <option value="all">Brands & agencies</option>
                        <option value="brand">Brands only</option>
                        <option value="agency">Agencies only</option>
                      </select>
                    </div>
                    <div className="results-label">
                      <span>
                        {loading
                          ? "Finding your next collaboration…"
                          : `${filtered.length} ${tab === "watchlist" ? "saved brands" : "brands & agencies"} to get to know`}
                      </span>
                      <label>
                        Sort by:{" "}
                        <select
                          aria-label="Sort brands"
                          value={sort}
                          onChange={(e) => setSort(e.target.value)}
                        >
                          <option value="popular">Featured</option>
                          <option value="az">A–Z</option>
                          <option value="reviewed">Most reviewed</option>
                        </select>
                      </label>
                    </div>
                    {error ? (
                      <div className="empty" role="alert">
                        <p>{error}</p>
                        <button onClick={() => setVersion((v) => v + 1)}>
                          Try again
                        </button>
                      </div>
                    ) : loading ? (
                      <div className="brand-grid">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                          <div className="skeleton" key={i} />
                        ))}
                      </div>
                    ) : (
                      <div className="brand-grid">
                        {filtered.slice(0, expanded ? 100 : 6).map((b) => (
                          <motion.article key={b.id} className="brand-card">
                            <div className="brand-card-top">
                              <BrandLogo brand={b} />
                              <button
                                aria-label={`${saved.some((s) => s.id === b.id) ? "Unsave" : "Save"} ${b.name}`}
                                className={
                                  "save-button " +
                                  (saved.some((s) => s.id === b.id)
                                    ? "is-saved"
                                    : "")
                                }
                                onClick={() => toggle(b)}
                              >
                                <Icon name="bookmark" size={19} />
                              </button>
                            </div>
                            <button
                              className="brand-title"
                              onClick={() => choose(b)}
                            >
                              {b.name}
                              <Icon name="arrow" size={19} />
                            </button>
                            <div className="handle">@{b.instagram_handle}</div>
                            <div className="brand-tags">
                              <span>{b.category}</span>
                              <span>
                                {b.entity_type === "brand" ? "Brand" : "Agency"}
                              </span>
                              {b.demo && <span className="demo-tag">Demo</span>}
                              {b.status === "pending_review" && (
                                <span>newly added</span>
                              )}
                            </div>
                            <div className="brand-card-bottom">
                              <span>
                                {b.review_count ? (
                                  <>
                                    <span className="star">★</span>{" "}
                                    {b.review_count} creator reviews
                                  </>
                                ) : (
                                  <>
                                    <span className="empty-star">☆</span> No
                                    reviews yet
                                  </>
                                )}
                              </span>
                              <button onClick={() => startReview(b)}>
                                {b.review_count ? "Add yours" : "Be the first"}{" "}
                                <span>↗</span>
                              </button>
                            </div>
                          </motion.article>
                        ))}
                      </div>
                    )}
                    {!loading && !filtered.length && (
                      <div className="empty">
                        <Icon name="bookmark" size={30} />
                        <h3>
                          {tab === "watchlist"
                            ? watchQuery
                              ? "No saved brands match your search."
                              : "Your next great collab belongs here."
                            : "A fresh space for new stories."}
                        </h3>
                        <p>
                          {tab === "watchlist"
                            ? watchQuery
                              ? "Try a different name or category, or clear your search."
                              : "Tap the bookmark on any brand to save it."
                            : "No brands in this category yet. Add one to get started."}
                        </p>
                        <button
                          className="outline-button"
                          onClick={() =>
                            tab === "watchlist"
                              ? watchQuery
                                ? setSavedQuery("")
                                : navigate("discover")
                              : setModal("add")
                          }
                        >
                          {tab === "watchlist"
                            ? watchQuery
                              ? "Clear search"
                              : "Explore brands"
                            : "Add a brand"}
                        </button>
                      </div>
                    )}
                    {filtered.length > 6 && !expanded && (
                      <button
                        className="browse-all"
                        onClick={() => setExpanded(true)}
                      >
                        Explore all {filtered.length} brands & agencies{" "}
                        <Icon name="arrow" size={17} />
                      </button>
                    )}
                  </section>
                )}
                {(tab === "discover" || tab === "reviews") && (
                  <section className="community">
                    <div className="section-heading">
                      <div>
                        <div className="eyebrow">Recent activity</div>
                        <h2>
                          From the creator community
                          <span className="heading-dot">.</span>
                        </h2>
                        <p>
                          Anonymous collaboration reports. No real names, ever.
                        </p>
                      </div>
                      {tab === "discover" ? (
                        <button
                          className="text-button"
                          onClick={() => navigate("reviews")}
                        >
                          All reviews <Icon name="arrow" size={17} />
                        </button>
                      ) : (
                        <button
                          className="primary-button"
                          onClick={() => startReview()}
                        >
                          Share your experience <Icon name="plus" size={17} />
                        </button>
                      )}
                    </div>
                    <ContentSearch
                      value={communityQuery}
                      onChange={setCommunityQuery}
                      label="Search opinions"
                      placeholder="Search experiences, brands, or a question on your mind…"
                      count={communityMatches.length}
                      suggestions={[
                        "Late payments",
                        "Creative",
                        "Usage rights",
                      ]}
                    />
                    <div className="demo-notice">
                      <span /> A peek at what’s possible. These sample reviews
                      feature fictional brands.
                    </div>
                    {opinionQuery && !communityMatches.length && (
                      <div className="search-empty">
                        <h3>No experiences found for “{communityQuery}”.</h3>
                        <p>
                          Try a brand name or a topic like payment, revisions,
                          or creative freedom.
                        </p>
                        <button
                          className="outline-button"
                          onClick={() => setCommunityQuery("")}
                        >
                          Clear search
                        </button>
                      </div>
                    )}
                    <div className="review-grid">
                      {communityMatches
                        .slice(0, tab === "discover" && !opinionQuery ? 2 : 100)
                        .map((r) => {
                          const b = brands.find((b) => b.id === r.brand_id);
                          return (
                            b &&
                            (reviews.indexOf(r) <
                            (!session
                              ? 1
                              : session.contributions
                                ? Infinity
                                : 3) ? (
                              <ReviewCard
                                key={r.id}
                                review={r}
                                brand={b}
                                gated={false}
                                onUnlock={() => startReview(b)}
                                onChoose={() => choose(b)}
                              />
                            ) : (
                              <div key={r.id} className="frosted-gate">
                                <div
                                  className="frosted-shapes"
                                  aria-hidden="true"
                                >
                                  <i />
                                  <i />
                                  <i />
                                  <i />
                                </div>
                                <div>
                                  <Icon name="lock" />
                                  <h3>
                                    {session
                                      ? "Share one collab. See the whole picture."
                                      : "Sign in for more creator experiences."}
                                  </h3>
                                  <p>
                                    {session
                                      ? "Your first contribution unlocks reviews and rates."
                                      : "Read three reviews when you join."}
                                  </p>
                                  <button
                                    className="primary-button"
                                    onClick={() => startReview(b)}
                                  >
                                    {session ? "Post your collab" : "Sign in"}
                                  </button>
                                </div>
                              </div>
                            ))
                          );
                        })}
                    </div>
                  </section>
                )}
                {tab === "rates" && (
                  <RatesExplorer
                    category={category}
                    setCategory={setCategory}
                    session={session}
                    version={version}
                    onUnlock={() => startReview()}
                    onShare={() => setModal("share")}
                  />
                )}
                {tab === "rooms" && (
                  <Rooms
                    session={session}
                    version={version}
                    onSignIn={() => setModal("auth")}
                  />
                )}
                {tab === "discover" && (
                  <section className="contribute-banner">
                    <div className="banner-flower">✳</div>
                    <div>
                      <h2>
                        Your last collab could help
                        <br />
                        someone’s next one.
                      </h2>
                      <p>
                        Good, bad, or somewhere in between. Your story matters.
                      </p>
                    </div>
                    <button onClick={() => startReview()}>
                      Share your experience <Icon name="arrow" size={18} />
                    </button>
                    <span className="banner-privacy">
                      <Icon name="shield" size={14} /> Always anonymous. Always
                      useful.
                    </span>
                  </section>
                )}
              </>
            )}
            <footer>
              <Link href="/" className="footer-logo">
                kollab.
              </Link>
              <span>A better creator economy starts with us.</span>
              <button onClick={() => setModal("about")}>Our promise ↗</button>
              <small>© 2026 Kollab</small>
            </footer>
          </main>
        </div>
        <nav className="mobile-nav">
          {[
            ["discover", "grid", "Discover"],
            ["reviews", "edit", "Reviews"],
            ["rooms", "users", "Rooms"],
            ["rates", "chart", "Rates"],
            ["watchlist", "bookmark", "Saved"],
          ].map(([t, i, l]) => (
            <button
              className={tab === t ? "active" : ""}
              key={t}
              onClick={() => navigate(t)}
            >
              <Icon name={i} />
              {l}
            </button>
          ))}
        </nav>
        {process.env.NODE_ENV === "development" && (
          <div className="dev-toolbar">
            <span>◉ DEMO</span>
            <select
              aria-label="Demo session"
              value={
                !session
                  ? "logged_out"
                  : session.contributions
                    ? "contributor"
                    : "new"
              }
              onChange={(e) =>
                repo
                  .setSession(
                    e.target.value as "logged_out" | "new" | "contributor",
                  )
                  .catch(() => setToast("Could not switch session"))
              }
            >
              <option value="logged_out">Logged out</option>
              <option value="new">New creator</option>
              <option value="contributor">Contributor</option>
            </select>
            <label>
              <input
                type="checkbox"
                checked={forceFail}
                onChange={(e) => setForceFail(e.target.checked)}
              />{" "}
              Fail auth
            </label>
            <button
              onClick={() =>
                repo
                  .reset()
                  .then(() => setToast("Demo data reset"))
                  .catch(() => setToast("Could not reset demo"))
              }
            >
              Reset data ↺
            </button>
          </div>
        )}
        <AnimatePresence>
          {toast && (
            <motion.div
              role="status"
              className="toast"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Icon name="check" size={18} />
              {toast}
            </motion.div>
          )}
          {modal && (
            <motion.div
              className="modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModal(null)}
            >
              <motion.section
                role="dialog"
                aria-modal="true"
                aria-label={
                  modal === "review"
                    ? "Share your experience"
                    : modal === "add"
                      ? "Add a brand"
                      : modal === "auth"
                        ? "Creator sign in"
                        : "About Kollab"
                }
                className="modal"
                initial={{ y: 25, scale: 0.98 }}
                animate={{ y: 0, scale: 1 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  autoFocus
                  className="modal-close icon-button"
                  aria-label="Close dialog"
                  onClick={() => setModal(null)}
                >
                  <Icon name="close" />
                </button>
                {modal === "share" ? (
                  <ShareCard
                    brand={detail}
                    aggregates={aggregates}
                    category={category}
                  />
                ) : modal === "profile" ? (
                  <ProfileSetup
                    onDone={() => {
                      setModal("review");
                      setReviewIntent(true);
                    }}
                  />
                ) : modal === "add" ? (
                  <AddBrand
                    onChoose={(b) => {
                      setSelected(b);
                      setReviewIntent(true);
                      setModal(session ? "review" : "auth");
                    }}
                  />
                ) : modal === "review" ? (
                  <ReviewWizard
                    brand={selected}
                    onSelect={setSelected}
                    onAdd={() => setModal("add")}
                    onDone={(b) => {
                      setModal(null);
                      choose(b);
                      setToast(
                        "Your review is live. Thanks for paying it forward.",
                      );
                    }}
                  />
                ) : modal === "auth" ? (
                  <Auth
                    forceFail={forceFail}
                    session={session}
                    onDone={(signedOut) => {
                      setModal(
                        signedOut
                          ? null
                          : session?.contributions
                            ? reviewIntent
                              ? "review"
                              : null
                            : "profile",
                      );
                      setToast(
                        signedOut
                          ? "Signed out."
                          : "Signed in. Your public identity stays anonymous.",
                      );
                    }}
                  />
                ) : (
                  <>
                    <div className="modal-emblem">✳</div>
                    <div className="eyebrow">OUR PROMISE TO CREATORS</div>
                    <h2>
                      A little honesty
                      <br />
                      changes everything.
                    </h2>
                    <p>
                      Kollab is a space for Indian creators to share what
                      working with a brand is really like. Clear briefs, late
                      payments, creative freedom — the things that matter.
                    </p>
                    <div className="promise-list">
                      <p>
                        <Icon name="shield" /> Your reviews never show your
                        identity.
                      </p>
                      <p>
                        <Icon name="heart" /> No brand-sponsored rankings. Ever.
                      </p>
                      <p>
                        <Icon name="users" /> Shared experiences, stronger
                        creators.
                      </p>
                    </div>
                    <small>
                      This is a front-end demo. Sign-in is simulated, data stays
                      in this browser, and sample reviews only feature fictional
                      brands.
                    </small>
                  </>
                )}
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
export function ReviewCard({
  review: r,
  brand: b,
  onChoose,
}: {
  review: Review;
  brand: Brand;
  gated?: boolean;
  onUnlock?: () => void;
  onChoose?: () => void;
}) {
  const [report, setReport] = useState(false);
  const [origin, setOrigin] = useState<CardOrigin | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const closeReview = useCallback(() => setOrigin(null), []);
  const openReview = () => {
    if (r.id === "preview" || report) return;
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect)
      setOrigin({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
  };
  return (
    <article
      ref={cardRef}
      className={
        "review-card " +
        (r.id !== "preview" ? "expandable-review " : "") +
        (origin ? "review-is-open" : "")
      }
      onClick={(e) => {
        if (
          !(e.target as HTMLElement).closest(
            "button,a,input,select,textarea,summary,details",
          )
        )
          openReview();
      }}
    >
      <div className="review-card-head">
        <BrandLogo brand={b} small />
        <button onClick={openReview}>
          <b>{b.name}</b>
          <small>{b.demo ? "Fictional demo brand" : b.category}</small>
        </button>
        <span
          className={
            "semantic-badge " + (r.would_work_again ? "good" : "caution")
          }
        >
          {r.would_work_again ? "Would work again" : "Wouldn’t repeat"}
        </span>
      </div>
      <div className="structured-review">
        <div>
          <small>Collaboration</small>
          <b>{r.deal_type.replaceAll("_", " ")}</b>
        </div>
        <div>
          <small>Payment</small>
          <b
            className={
              r.payment_status === "paid_on_time"
                ? "good-text"
                : r.payment_status === "never_paid"
                  ? "bad-text"
                  : "caution-text"
            }
          >
            {r.payment_status.replaceAll("_", " ")}
          </b>
        </div>
        <div>
          <small>Agreed cash</small>
          <b>{money(r.cash_amount_inr)}</b>
        </div>
        <div>
          <small>Time to payment</small>
          <b>
            {r.days_to_payment === null
              ? "Not received"
              : r.days_to_payment + " days"}
          </b>
        </div>
      </div>
      {r.body && <p>{r.body}</p>}
      <div className="review-meta">
        <span>
          <Icon name="shield" size={14} /> Anonymous creator
        </span>
        <span>
          {r.follower_band.replaceAll("_", "–")} followers · {r.collab_month}
        </span>
        {r.proof_status === "verified" && (
          <span className="verified">
            ✓ Receipts verified {r.demo ? "(demo)" : ""}
          </span>
        )}
      </div>
      <div className="review-rate">
        <span>
          Communication {r.rating_communication}/5 · Professionalism{" "}
          {r.rating_professionalism}/5
        </span>
        <button onClick={() => setReport(true)}>Report</button>
      </div>
      {r.reply && (
        <details>
          <summary>Official brand response · demo</summary>
          <p>{r.reply}</p>
        </details>
      )}
      {r.id !== "preview" && (
        <button className="expand-review-button" onClick={openReview}>
          Read the full experience <span>↗</span>
        </button>
      )}
      {report && (
        <ReportDialog targetId={r.id} onClose={() => setReport(false)} />
      )}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {origin && (
              <ReviewDetail
                key={r.id}
                review={r}
                brand={b}
                origin={origin}
                onClose={closeReview}
                onChoose={onChoose}
              />
            )}
          </AnimatePresence>,
          document.body,
        )}
    </article>
  );
}
function AddBrand({ onChoose }: { onChoose: (b: Brand) => void }) {
  const [similar, setSimilar] = useState<Brand[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    instagram_handle: "",
    category: "Beauty",
    website: "",
    entity_type: "brand" as "brand" | "agency",
  });
  async function submit(e: FormEvent, override = false) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const parsed = brandInput.safeParse(draft);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      if (!override) {
        const bs = await repo.findSimilarBrands(
          draft.name,
          draft.instagram_handle,
        );
        if (bs.length) {
          setSimilar(bs);
          return;
        }
      }
      onChoose(await repo.createBrand(draft));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to add brand. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="eyebrow">MAKE THE DIRECTORY A LITTLE BETTER</div>
      <h2>
        A new name.
        <br />
        More possibilities.
      </h2>
      <p>
        Add the brand or agency you’ve worked with. We’ll take you straight to
        your review.
      </p>
      <form onSubmit={submit}>
        <div className="segmented">
          {(["brand", "agency"] as const).map((t) => (
            <button
              type="button"
              key={t}
              className={draft.entity_type === t ? "selected" : ""}
              onClick={() => setDraft({ ...draft, entity_type: t })}
            >
              {t === "brand" ? "Brand" : "Agency"}
            </button>
          ))}
        </div>
        <label>
          Brand or agency name
          <input
            required
            minLength={2}
            value={draft.name}
            onChange={(e) => {
              setSimilar([]);
              setDraft({ ...draft, name: e.target.value });
            }}
            placeholder="e.g. Sunday Theory"
          />
        </label>
        <label>
          Instagram handle
          <input
            required
            minLength={2}
            value={draft.instagram_handle}
            onChange={(e) => {
              setSimilar([]);
              setDraft({ ...draft, instagram_handle: e.target.value });
            }}
            placeholder="@thebrand"
          />
        </label>
        <div className="form-row">
          <label>
            Category
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            >
              {categories.slice(1).map((c) => (
                <option key={c}>{c}</option>
              ))}
              <option>Agency</option>
            </select>
          </label>
          <label>
            Website <span>(optional)</span>
            <input
              type="url"
              value={draft.website}
              onChange={(e) => setDraft({ ...draft, website: e.target.value })}
              placeholder="https://…"
            />
          </label>
        </div>
        {similar.length > 0 && (
          <div className="similar-panel">
            <b>Did you mean one of these?</b>
            {similar.map((b) => (
              <button type="button" key={b.id} onClick={() => onChoose(b)}>
                <BrandLogo brand={b} small />
                {b.name}
                <Icon name="arrow" size={16} />
              </button>
            ))}
            <button
              type="button"
              className="text-button"
              onClick={(e) => submit(e, true)}
              disabled={busy}
            >
              It’s a different brand. Add it anyway →
            </button>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button disabled={busy} className="primary-button full">
          {busy ? "Checking the directory…" : "Add brand & write a review"}
          <Icon name="arrow" size={16} />
        </button>
        <small className="form-footnote">
          New additions are marked “newly added” while awaiting review.
        </small>
      </form>
    </>
  );
}
function Auth({
  forceFail,
  session,
  onDone,
}: {
  forceFail: boolean;
  session: Session | null;
  onDone: (signedOut?: boolean) => void;
}) {
  const [step, setStep] = useState("start"),
    [handle, setHandle] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function verify() {
    setBusy(true);
    setError("");
    await new Promise((r) => setTimeout(r, 900));
    try {
      if (forceFail)
        throw new Error(
          "We couldn’t verify your Instagram. Try again or use the bio-code option.",
        );
      await repo.setSession(
        session?.contributions ? "contributor" : "new",
        handle.replace(/^@/, "") || "creator",
      );
      onDone();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Verification failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="modal-emblem">✳</div>
      <div className="eyebrow">A LITTLE TRUST GOES A LONG WAY</div>
      <h2>{session ? "Your creator space." : "You’re in good company."}</h2>
      <p>
        {session
          ? `Signed in as ${session.alias}. Your Instagram handle is never shown publicly.`
          : "Join a community making brand collaborations better, one honest experience at a time."}
      </p>
      <div className="auth-benefits">
        <span>
          <Icon name="shield" /> Anonymous reviews
        </span>
        <span>
          <Icon name="chart" /> Community rate insights
        </span>
        <span>
          <Icon name="bookmark" /> Your personal watchlist
        </span>
      </div>
      {step === "bio" && (
        <div className="bio-code">
          <b>Verify with your Instagram bio</b>
          <p>
            Add this code to your Instagram bio, then select verify. You can
            remove it afterwards.
          </p>
          <code>KOLLAB-CREATOR-26</code>
        </div>
      )}
      <label>
        Instagram handle
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@yourhandle"
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="primary-button full"
        disabled={busy || !handle.trim()}
        onClick={verify}
      >
        <Icon name="instagram" size={19} />
        {busy
          ? "Verifying…"
          : step === "bio"
            ? "Verify my bio"
            : "Continue with Instagram"}
      </button>
      <button
        className="auth-fallback"
        onClick={() => {
          setStep(step === "bio" ? "start" : "bio");
          setError("");
        }}
      >
        {step === "bio"
          ? "Back to Instagram sign in"
          : "Having trouble? Verify with a bio code →"}
      </button>
      <small className="form-footnote">
        Demo sign-in: no Instagram connection is made. Verification is
        simulated.
      </small>
      {session && (
        <button
          className="auth-fallback"
          onClick={() => repo.setSession("logged_out").then(() => onDone(true))}
        >
          Sign out
        </button>
      )}
    </>
  );
}
