import type { KollabRepo } from "./repo";
import type { Brand } from "./types";

export async function dataRequest<T>(action: string, input: unknown = {}, write = false): Promise<T> {
  const encoded = new URLSearchParams({ action, input: JSON.stringify(input) });
  const response = await fetch(write ? "/api/data/" : `/api/data/?${encoded}`, {
    method: write ? "POST" : "GET", cache: "no-store", credentials: "same-origin",
    ...(write ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, input }) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not complete this request. Please try again.");
  if (write && typeof window !== "undefined") window.dispatchEvent(new Event("kollab-change"));
  return result.data as T;
}

export const httpRepo: KollabRepo = {
  searchBrands: (query, limit) => dataRequest("searchBrands", { query, limit }),
  getBrand: (slug) => dataRequest("getBrand", { slug }),
  createBrand: (input) => dataRequest("createBrand", input, true),
  async findSimilarBrands(name, handle) {
    const lists = await Promise.all([this.searchBrands(name), ...(handle ? [this.searchBrands(handle)] : [])]);
    return [...new Map(lists.flat().map((b: Brand) => [b.id, b])).values()];
  },
  listReviews: (brandId, filters) => dataRequest("listReviews", { brandId, filters }),
  createReview: (input) => dataRequest("createReview", input, true),
  getBrandAggregates: (brandId) => dataRequest("getBrandAggregates", { brandId }),
  getRates: (input) => dataRequest("getRates", input),
  getWatchlist: () => dataRequest("getWatchlist"),
  toggleWatchlist: (brandId) => dataRequest("toggleWatchlist", { brandId }, true),
  getSession: () => dataRequest("getSession"),
  async setSession(mode) {
    if (mode !== "logged_out") throw new Error("Use email sign-in to access your account.");
    const response = await fetch("/api/auth/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "signout" }) });
    if (!response.ok) throw new Error("Could not sign out. Try again.");
    window.dispatchEvent(new Event("kollab-change"));
    return null;
  },
  updateProfile: (input) => dataRequest("updateProfile", input, true),
  listPosts: (category, query) => dataRequest("listPosts", { category, query }),
  createPost: (category, body, identityMode = "anonymous") => dataRequest("createPost", { category, body, identity_mode: identityMode, attribution_consent: identityMode === "attributed" }, true),
  comment: (postId, body, identityMode = "anonymous") => dataRequest("comment", { post_id: postId, body, identity_mode: identityMode, attribution_consent: identityMode === "attributed" }, true),
  vote: (targetId) => dataRequest("vote", { targetId }, true),
  report: (targetId, reason) => dataRequest("report", { targetId, reason }, true),
  getNotifications: () => dataRequest("getNotifications"),
  markNotificationsRead: () => dataRequest("markNotificationsRead", {}, true),
  async reset() { throw new Error("Demo reset is unavailable for real accounts."); },
};
