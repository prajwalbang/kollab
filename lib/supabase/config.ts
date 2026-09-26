import "server-only";

export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) throw new Error("Supabase is not configured yet.");
  const parsed = new URL(url);
  const local = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if ((parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/")
    throw new Error("Invalid Supabase URL.");
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))
    throw new Error("Use a Supabase publishable key, never a secret key.");
  return { url: parsed.origin, key };
}

// The secret is configured in Supabase Auth, where verification cannot be bypassed
// by calling its public Auth API directly. This flag records that deployment step.
export function captchaConfig() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const enabled = process.env.SUPABASE_CAPTCHA_ENABLED === "true";
  return { siteKey: siteKey || null, enabled, ready: Boolean(siteKey && enabled) };
}
