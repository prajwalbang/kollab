import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Kollab from "@/components/kollab";
import { publicCompany, siteOrigin, anonymousDatabase } from "./public-server";
import { liveData } from "./mode";

export async function companyMetadata(slug: string, entity: "brand" | "agency"): Promise<Metadata> {
  const data = await publicCompany(slug);
  if (!data || data.brand.entity_type !== entity) return { title: "Company unavailable · Kollab", robots: { index: false, follow: false } };
  const { brand } = data;
  const title = `${brand.name} creator reviews and collaboration rates · Kollab`;
  const description = `${brand.category} ${entity}. ${brand.review_count} published collaboration reports. See creator experiences and privacy-protected payment information.`;
  const url = `${siteOrigin()}/${entity}/${slug}/`;
  return { title, description, alternates: { canonical: url },
    robots: { index: liveData && !brand.demo && brand.status === "active" && brand.review_count > 0, follow: true },
    openGraph: { title, description, url, images: [{ url: `${siteOrigin()}/api/og/?slug=${encodeURIComponent(slug)}`, width: 1200, height: 630 }] },
  };
}
export async function CompanyPage({ slug, entity }: { slug: string; entity: "brand" | "agency" }) {
  const data = await publicCompany(slug);
  // Pending companies remain visible only to their creator via the authenticated API.
  // Don't SSR a private page. The client performs its own authorization check.
  if (!data) {
    if (liveData) {
      const result = await anonymousDatabase().rpc('kollab_resolve_slug', {slug});
      if(result.error) throw new Error('Company directory unavailable.');
      if(result.data && result.data.slug !== slug) permanentRedirect(`/${result.data.entity_type}/${result.data.slug}/`);
    }
    return <Kollab initialSlug={slug} />;
  }
  if (data.brand.entity_type !== entity) notFound();
  return <Kollab initialSlug={slug} initialBrand={data.brand} initialReviews={data.reviews} initialAggregates={data.aggregates} />;
}
