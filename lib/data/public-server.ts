import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/supabase/config";
import { liveData } from "./mode";
import type { Aggregates, Brand, Review } from "./types";
import brands from "@/data/brands.json";

// Public pages, metadata and social images ALWAYS use an anonymous client.
// Never cache session-aware queries in public metadata or an OG image.
export function anonymousDatabase() {
  const { url, key } = supabaseConfig();
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) } });
}
export const publicCompany = cache(async (slug: string) => {
  if (!/^[a-z0-9-]{1,160}$/.test(slug)) return null;
  if (!liveData) {
    const fixture = brands.find((b) => b.slug === slug);
    if (!fixture) return null;
    const { created_by_user_id, claimed_by_user_id, ...safe } = fixture;
    void created_by_user_id; void claimed_by_user_id;
    return { brand: { ...safe, review_count: 0 } as Brand, reviews: [] as Review[], aggregates: null as Aggregates | null };
  }
  const client = anonymousDatabase();
  const company = await client.rpc("kollab_search_brands", { wanted_slug: slug });
  if (company.error) throw new Error("Company directory unavailable.");
  const brand = company.data?.[0] as Brand | undefined;
  if (!brand) return null;
  const [reviews, aggregates] = await Promise.all([
    client.rpc("kollab_list_reviews", { brand: brand.id }), client.rpc("kollab_aggregates", { brand: brand.id }),
  ]);
  if (reviews.error || aggregates.error) throw new Error("Company data unavailable.");
  return { brand, reviews: reviews.data as Review[], aggregates: aggregates.data as Aggregates };
});

export function siteOrigin() {
  return process.env.APP_ORIGIN || "http://localhost:3000";
}
