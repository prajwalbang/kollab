import { serverSupabase } from "@/lib/supabase/server";
import { json } from "@/lib/supabase/http";
import { liveData } from "@/lib/data/mode";
import { captchaConfig } from "@/lib/supabase/config";
export async function GET() {
  try {
    if (!liveData) return json({ signedIn: false, instagramVerified: false, available: false });
    const captcha = captchaConfig();
    const available = process.env.NODE_ENV !== "production" || captcha.ready;
    const client = await serverSupabase();
    // getUser validates against Auth and refreshes expired sessions via writable
    // route cookies. Never trust getSession's cookie payload as identity.
    const { data: { user }, error } = await client.auth.getUser();
    if (!user || error) return json({ signedIn: false, instagramVerified: false, available });
    const { data, error: profileError } = await client.rpc("kollab_session");
    if (profileError) return json({ error: "Account database is not ready yet." }, 503);
    return json({ signedIn: true, instagramVerified: Boolean(data?.verified), available: true });
  } catch { return json({ error: "Account service is not configured." }, 503); }
}
