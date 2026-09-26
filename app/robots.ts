import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/data/public-server";
import { liveData } from "@/lib/data/mode";
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", ...(liveData ? { allow: "/", disallow: ["/api/", "/auth/", "/account/", "/admin/", "/represent/"] } : { disallow: "/" }) }, sitemap: `${siteOrigin()}/sitemap.xml` };
}
