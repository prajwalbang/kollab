import Fuse from "fuse.js";
import { searchItems } from "./search";
import brandsFixture from "@/data/brands.json";
import reviewsFixture from "@/data/reviews.json";
import {
  brandInput,
  reviewInput,
  type Brand,
  type CollabReview,
  type Review,
  type Session,
  type RoomPost,
  type Notification,
  type Report,
  type NewReview,
} from "./types";
import type { KollabRepo } from "./repo";
type StoredReview = CollabReview &
  Pick<Review, "follower_band" | "category" | "region" | "reply" | "demo"> & {
    creator_city: string | null;
  };
type Store = {
  brands: Brand[];
  reviews: StoredReview[];
  watchlist: string[];
  session: Session | null;
  posts: RoomPost[];
  votes: string[];
  reports: Report[];
  notifications: Notification[];
};
const KEY = "kollab:demo:v2";
const initial = (): Store => ({
  brands: [],
  reviews: [],
  watchlist: [],
  session: null,
  posts: [],
  votes: [],
  reports: [],
  notifications: [],
});
function read(): Store {
  if (typeof window === "undefined") return initial();
  const raw = localStorage.getItem(KEY);
  if (!raw) return initial();
  try {
    return { ...initial(), ...JSON.parse(raw) };
  } catch {
    return initial();
  }
}
function write(s: Store) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event("kollab-change"));
}
function allReviews() {
  return [...reviewsFixture, ...read().reviews].filter(
    (r) => r.visibility === "published",
  ) as StoredReview[];
}
function forBrand(id: string) {
  return allReviews().filter((r) => r.brand_id === id || r.agency_id === id);
}
function publicReview(r: StoredReview): Review {
  const {
    user_id,
    created_at,
    edited_at,
    removed_reason,
    creator_city,
    ...safe
  } = r;
  void user_id;
  void created_at;
  void edited_at;
  void removed_reason;
  void creator_city;
  return safe;
}
function allBrands(): Brand[] {
  return [...brandsFixture, ...read().brands]
    .filter((b) => b.status !== "hidden" && b.status !== "merged")
    .map((b) => {
      const { created_by_user_id, claimed_by_user_id, ...safe } =
        b as typeof b & {
          created_by_user_id?: string;
          claimed_by_user_id?: string;
        };
      void created_by_user_id;
      void claimed_by_user_id;
      return { ...safe, review_count: forBrand(b.id).length } as Brand;
    });
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function search(query: string, threshold = 0.35) {
  const bs = allBrands();
  if (!query.trim()) return bs;
  return new Fuse(
    bs.map((b) => ({
      ...b,
      normalized_name: norm(b.name),
      normalized_handle: norm(b.instagram_handle),
    })),
    { keys: ["normalized_name", "normalized_handle"], threshold },
  )
    .search(norm(query))
    .map((r) => r.item);
}
function weightedMedian(
  rs: StoredReview[],
  key:
    | "cash_amount_inr"
    | "days_to_payment"
    | "product_claimed_value_inr"
    | "product_actual_value_inr",
) {
  const sorted = rs
    .filter((r) => r[key] !== null)
    .sort((a, b) => a[key]! - b[key]!);
  if (sorted.length < 3) return null;
  let sum = 0;
  const half = sorted.reduce((s, r) => s + r.trust_score, 0) / 2;
  for (const r of sorted) {
    sum += r.trust_score;
    if (sum >= half) return r[key];
  }
  return null;
}
function requireSession() {
  const s = read();
  if (!s.session) throw new Error("Sign in to contribute to the community.");
  return s as Store & { session: Session };
}
function moderate(body: string) {
  if (/\b\S+@\S+\.\S+\b|(?:\+91[ -]?)?\d[\d -]{8,}\d|@[a-z0-9_.]+/i.test(body))
    throw new Error(
      "Remove contact details and personal handles. Describe the collaboration without identifying an individual.",
    );
  if (/\b(fuck|bitch|bastard)\b/i.test(body))
    throw new Error(
      "Please remove abusive language and describe your first-hand experience.",
    );
}
export const mockRepo: KollabRepo = {
  async searchBrands(q, limit = 50) {
    return search(q).slice(0, limit);
  },
  async getBrand(slug) {
    return allBrands().find((b) => b.slug === slug) || null;
  },
  async createBrand(input) {
    const valid = brandInput.parse(input);
    const brand: Brand = {
      ...valid,
      website: valid.website || null,
      id: crypto.randomUUID(),
      slug: norm(valid.name) + "-" + crypto.randomUUID().slice(0, 6),
      status: "pending_review",
      demo: false,
      color: "#e4e8f4",
      logo_url: null,
      hq_city: null,
      is_claimed: false,
      merged_into_id: null,
      created_at: new Date().toISOString(),
      review_count: 0,
    };
    const s = read();
    s.brands.push(brand);
    write(s);
    return brand;
  },
  async findSimilarBrands(name, handle) {
    return [
      ...new Map(
        [...search(name, 0.25), ...(handle ? search(handle, 0.2) : [])].map(
          (b) => [b.id, b],
        ),
      ).values(),
    ];
  },
  async listReviews(id, f) {
    return allReviews()
      .filter(
        (r) =>
          (!id || r.brand_id === id || r.agency_id === id) &&
          (!f?.band || r.follower_band === f.band) &&
          (!f?.category || r.category === f.category) &&
          (!f?.deal_type || r.deal_type === f.deal_type) &&
          (!f?.year || r.collab_month.startsWith(f.year)),
      )
      .sort(
        (a, b) =>
          (b.proof_status === "verified" ? 1 : 0) -
            (a.proof_status === "verified" ? 1 : 0) ||
          b.helpful_count - a.helpful_count,
      )
      .map(publicReview);
  },
  async createReview(input) {
    const s = requireSession();
    const valid = reviewInput.parse(input);
    moderate(valid.body || "");
    if (
      s.reviews.some(
        (r) =>
          r.user_id === s.session.id &&
          r.brand_id === valid.brand_id &&
          r.collab_month === valid.collab_month,
      )
    )
      throw new Error(
        "You already shared this brand collaboration for that month. Choose the month of a different collaboration.",
      );
    if (!Object.values(valid.deliverables).some((n) => n > 0))
      throw new Error("Add at least one deliverable.");
    const r: StoredReview = {
      ...valid,
      id: crypto.randomUUID(),
      user_id: s.session.id,
      created_at: new Date().toISOString(),
      edited_at: null,
      removed_reason: null,
      proof_status: "none",
      visibility: "published",
      trust_score: 0.5,
      helpful_count: 0,
      follower_band: s.session.follower_band,
      category: s.session.category,
      creator_city: s.session.city,
      region:
        s.session.city === "Bangalore"
          ? "Karnataka"
          : s.session.city === "Mumbai"
            ? "Maharashtra"
            : null,
      reply: null,
      demo: false,
    };
    s.reviews.push(r);
    s.session.contributions++;
    if (s.watchlist.includes(r.brand_id))
      s.notifications.unshift({
        id: crypto.randomUUID(),
        brand_id: r.brand_id,
        message: `New collaboration shared for ${allBrands().find((b) => b.id === r.brand_id)?.name || "a saved brand"}.`,
        read: false,
      });
    write(s);
    return publicReview(r);
  },
  async getBrandAggregates(id) {
    const rs = forBrand(id);
    const total = rs.reduce((s, r) => s + r.trust_score, 0);
    const rate = (fn: (r: NewReview) => boolean) =>
      rs.length >= 3
        ? Math.round(
            (rs.filter(fn).reduce((s, r) => s + r.trust_score, 0) / total) *
              100,
          )
        : null;
    return {
      count: rs.length,
      would_work_again: rate((r) => r.would_work_again),
      on_time_rate: rate((r) => r.payment_status === "paid_on_time"),
      ghost_rate: rate((r) => r.ghost_stage !== "none"),
      median_days_to_payment: weightedMedian(rs, "days_to_payment"),
      median_cash: weightedMedian(rs, "cash_amount_inr"),
      product_claimed_value: weightedMedian(rs, "product_claimed_value_inr"),
      product_actual_value: weightedMedian(rs, "product_actual_value_inr"),
    };
  },
  async getRates(f) {
    const brandNames = new Map(
      allBrands().map((b) => [b.id, `${b.name} ${b.instagram_handle}`]),
    );
    const matched = searchItems(
      allReviews(),
      f.q || "",
      (r) =>
        `${brandNames.get(r.brand_id)} ${brandNames.get(r.agency_id || "") || ""} ${r.category} ${r.deal_type} ${r.creator_city || ""} ${Object.entries(
          r.deliverables,
        )
          .filter(([, n]) => n > 0)
          .map(([k]) => k)
          .join(" ")}`,
    );
    return [...new Set(allBrands().map((b) => b.category))]
      .filter((c) => !f.category || f.category === c)
      .map((category) => {
        const rs = matched.filter(
          (r) =>
            r.category === category &&
            (!f.brand_id ||
              r.brand_id === f.brand_id ||
              r.agency_id === f.brand_id) &&
            (!f.band || r.follower_band === f.band) &&
            (!f.deal_type || r.deal_type === f.deal_type) &&
            (!f.city || r.creator_city === f.city) &&
            (!f.deliverable ||
              r.deliverables[f.deliverable as keyof typeof r.deliverables] > 0),
        );
        return {
          category,
          count: rs.length,
          min:
            rs.length >= 3
              ? Math.min(...rs.map((r) => r.cash_amount_inr))
              : null,
          max:
            rs.length >= 3
              ? Math.max(...rs.map((r) => r.cash_amount_inr))
              : null,
          median: weightedMedian(rs, "cash_amount_inr"),
        };
      })
      .filter(
        (row) =>
          !f.q?.trim() ||
          row.count > 0 ||
          searchItems([row], f.q, (r) => r.category).length > 0,
      );
  },
  async getWatchlist() {
    return allBrands().filter((b) => read().watchlist.includes(b.id));
  },
  async toggleWatchlist(id) {
    const s = read();
    const added = !s.watchlist.includes(id);
    s.watchlist = added
      ? [...s.watchlist, id]
      : s.watchlist.filter((b) => b !== id);
    write(s);
    return added;
  },
  async getSession() {
    return read().session;
  },
  async setSession(mode, handle = "creator") {
    const s = read();
    s.session =
      mode === "logged_out"
        ? null
        : {
            id: "demo-user",
            handle,
            alias: "Quiet Mango",
            contributions: mode === "contributor" ? 1 : 0,
            follower_band: "10k_25k",
            category: "Beauty",
            city: "Mumbai",
          };
    write(s);
    return s.session;
  },
  async updateProfile(profile) {
    const s = requireSession();
    s.session = { ...s.session, ...profile };
    write(s);
    return s.session;
  },
  async listPosts(category) {
    return read().posts.filter((p) => p.category === category);
  },
  async createPost(category, body) {
    const s = requireSession();
    if (body.trim().length < 10 || body.length > 1200)
      throw new Error("Write between 10 and 1,200 characters.");
    moderate(body);
    const p: RoomPost = {
      id: crypto.randomUUID(),
      category,
      body: body.trim(),
      alias: s.session.alias,
      helpful_count: 0,
      comments: [],
      created_at: new Date().toISOString(),
    };
    s.posts.unshift(p);
    write(s);
    return p;
  },
  async comment(id, body) {
    const s = requireSession();
    if (!body.trim() || body.length > 1200)
      throw new Error("Write a comment between 1 and 1,200 characters.");
    moderate(body);
    const p = s.posts.find((p) => p.id === id);
    if (!p) throw new Error("This discussion is no longer available.");
    p.comments.push({
      id: crypto.randomUUID(),
      body: body.trim(),
      alias: s.session.alias,
    });
    write(s);
  },
  async vote(id) {
    const s = requireSession();
    const added = !s.votes.includes(id);
    s.votes = added ? [...s.votes, id] : s.votes.filter((v) => v !== id);
    const p = s.posts.find((p) => p.id === id);
    if (p) p.helpful_count += added ? 1 : -1;
    write(s);
    return added;
  },
  async report(id, reason) {
    const s = read();
    if (!reason.trim()) throw new Error("Choose a reason for this report.");
    s.reports.push({
      id: crypto.randomUUID(),
      target_id: id,
      reason,
      created_at: new Date().toISOString(),
    });
    write(s);
  },
  async getNotifications() {
    return read().notifications;
  },
  async markNotificationsRead() {
    const s = read();
    s.notifications.forEach((n) => (n.read = true));
    write(s);
  },
  async reset() {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("kollab-change"));
  },
};
