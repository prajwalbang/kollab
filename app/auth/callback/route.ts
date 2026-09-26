import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { appOrigin } from "@/lib/supabase/http";
import { liveData } from "@/lib/data/mode";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  let success = false;
  if (liveData && code && code.length < 4096) {
    try {
      const client = await serverSupabase();
      const { error } = await client.auth.exchangeCodeForSession(code);
      success = !error;
    } catch { /* Do not log authorization codes or session tokens. */ }
  }
  // Fixed destination: never use user-supplied next/redirect parameters.
  const response = NextResponse.redirect(new URL(success ? "/account/" : "/account/?error=expired", appOrigin()));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
