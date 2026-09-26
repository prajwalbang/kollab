import { serverSupabase } from "@/lib/supabase/server";
import { json, readJson, publicError } from "@/lib/supabase/http";
import { parseDataRequest, databaseError } from "@/lib/data/api-contract";
import { liveData } from "@/lib/data/mode";

async function run(action: string, input: unknown, write: boolean) {
  if (!liveData) return json({error:"Live accounts are not open in the demo."},503);
  let data: Record<string, unknown>;
  try { data = parseDataRequest(action, input, write) as Record<string, unknown>; }
  catch { return json({ error: "Invalid request. Check the supplied fields." }, 400); }
  try {
    const client = await serverSupabase();
    // getUser validates with Auth; don't authorize by trusting decoded cookies.
    if (write) {
      const { data: { user }, error } = await client.auth.getUser();
      if (error || !user) return json({ error: "Sign in to continue." }, 401);
    }
    let fn: string; let args: Record<string, unknown> = {};
    switch (action) {
      case "getSession": fn = "kollab_session"; break;
      case "searchBrands": fn = "kollab_search_brands"; args = { query: data.query, result_limit: data.limit || 50 }; break;
      case "getBrand": fn = "kollab_search_brands"; args = { wanted_slug: data.slug }; break;
      case "createBrand": fn = "kollab_create_brand"; args = { input: data }; break;
      case "updateProfile": fn = "kollab_update_profile"; args = { input: data }; break;
      case "listReviews": fn = "kollab_list_reviews"; args = { brand: data.brandId || null, filters: data.filters || {} }; break;
      case "createReview": fn = "kollab_create_review"; args = { input: data }; break;
      case "getBrandAggregates": fn = "kollab_aggregates"; args = { brand: data.brandId }; break;
      case "getRates": fn = "kollab_rates"; args = { filters: data }; break;
      case "getWatchlist": fn = "kollab_watchlist"; break;
      case "toggleWatchlist": fn = "kollab_watchlist"; args = { brand: data.brandId }; break;
      case "listPosts": fn = "kollab_list_posts"; args = { category: data.category, query: data.query || "" }; break;
      case "createPost": fn = "kollab_create_post"; args = { input: data }; break;
      case "comment": fn = "kollab_comment"; args = { input: data }; break;
      case "vote": fn = "kollab_vote"; args = { target: data.targetId }; break;
      case "report": fn = "kollab_report_target"; args = { target: data.targetId, reason: data.reason }; break;
      case "getNotifications": fn = "kollab_notifications"; break;
      case "markNotificationsRead": fn = "kollab_notifications"; args = { mark_read: true }; break;
      case "verificationStatus": fn = "kollab_verification"; break;
      case "verificationStart": fn = "kollab_verification"; args = { input: { action: "start", handle: data.handle } }; break;
      case "verificationSubmit": fn = "kollab_verification"; args = { input: { action: "submit", challenge_id: data.challenge_id } }; break;
      case "claimBrand": fn = "kollab_claim_brand"; args = { input:data }; break;
      case "reply": fn = "kollab_reply"; args = { input:data }; break;
      case "representativeReviews": fn = "kollab_representative_reviews"; args = { company:data.company_id }; break;
      default: return json({ error: "Unsupported action." }, 400);
    }
    const result = await client.rpc(fn, args);
    if (result.error) { const e = databaseError(result.error.code); return json({ error: e.error }, e.status); }
    return json({ data: action === "getBrand" ? (result.data?.[0] || null) : result.data });
  } catch { return json({ error: "The database connection is not ready. Please try again later." }, 503); }
}
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.search.length > 4096) return json({ error: "Query too long." }, 400);
  try { return await run(url.searchParams.get("action") || "", JSON.parse(url.searchParams.get("input") || "{}"), false); }
  catch { return json({ error: "Invalid query." }, 400); }
}
export async function POST(request: Request) {
  try {
    const body = await readJson(request) as { action?: unknown; input?: unknown };
    if (!body || typeof body !== 'object' || typeof body.action !== "string") return json({ error: "Action required." }, 400);
    return await run(body.action, body.input || {}, true);
  } catch (error) { return publicError(error, "Invalid request origin or body."); }
}
