import { z } from "zod";
import { serverSupabase } from "@/lib/supabase/server";
import { appOrigin, HttpError, json, publicError, readJson } from "@/lib/supabase/http";
import { captchaConfig } from "@/lib/supabase/config";
import { liveData } from "@/lib/data/mode";

const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("signin"), email: z.string().trim().email().max(254), captchaToken: z.string().min(1).max(2048).optional() }).strict(),
  z.object({ action: z.literal("signout") }).strict(),
]);

export async function POST(request: Request) {
  try {
    const parsed = input.safeParse(await readJson(request, 4096));
    if (!parsed.success) throw new HttpError("Enter a valid email address or sign-out request.");
    const body = parsed.data;
    if (!liveData) return json({ error: "Account sign-in is not open in the demo yet." }, 503);
    if (body.action === "signout") {
      const supabase = await serverSupabase();
      const { error } = await supabase.auth.signOut({ scope: "local" });
      return error ? json({ error: "Could not sign out. Please retry." }, 503) : json({ ok: true });
    }
    const captcha = captchaConfig();
    if (process.env.NODE_ENV === "production" && !captcha.ready)
      return json({ error: "Sign-in is being prepared. Please try again later." }, 503);
    if ((captcha.enabled || captcha.siteKey) && !body.captchaToken)
      throw new HttpError("Complete the security check, then try again.");
    const supabase = await serverSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email: body.email,
      options: { emailRedirectTo: `${appOrigin()}/auth/callback/`, captchaToken: body.captchaToken },
    });
    // Never reflect provider errors, email addresses or account-existence details.
    if (error?.status === 429) return json({ error: "Please wait before requesting another link." }, 429);
    if (error?.code === "captcha_failed") return json({ error: "The security check expired. Please try again." }, 400);
    if (error && (!error.status || error.status >= 500)) return json({ error: "Email sign-in is temporarily unavailable. Please try again later." }, 503);
    // Address-specific refusals receive exactly the same acknowledgement as success.
    return json({ ok: true });
  } catch (error) {
    return publicError(error, "Sign-in is temporarily unavailable. Please try again later.");
  }
}
