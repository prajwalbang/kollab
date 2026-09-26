import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";

// Used only in route handlers, where refreshed cookies can be written.
// All database calls carry the user's JWT; no service-role bypass exists here.
export async function serverSupabase() {
  const { url, key } = supabaseConfig();
  const jar = await cookies();
  return createServerClient(url, key, {
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => values.forEach(({ name, value, options }) => jar.set(name, value, {
        ...options, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/",
      })),
    },
  });
}
