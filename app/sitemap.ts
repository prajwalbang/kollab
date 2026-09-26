import type { MetadataRoute } from "next";
import { anonymousDatabase, siteOrigin } from "@/lib/data/public-server";
import { liveData } from "@/lib/data/mode";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!liveData) return [];
  const client = anonymousDatabase();
  const pages: MetadataRoute.Sitemap = [{ url: `${siteOrigin()}/`, priority: 1 }];
  let after = "";
  // Bound each request; shard sitemap when the directory grows beyond 10k.
  for (let i = 0; i < 20; i++) {
    const { data, error } = await client.rpc("kollab_sitemap", { after_slug: after, result_limit: 500 });
    if (error) throw new Error("Sitemap unavailable.");
    const rows = data as { slug: string; entity_type: string }[];
    pages.push(...rows.map((row) => ({ url: `${siteOrigin()}/${row.entity_type}/${row.slug}/`, priority: 0.7 })));
    if (rows.length < 500) break;
    after = rows[rows.length - 1].slug;
  }
  return pages;
}
