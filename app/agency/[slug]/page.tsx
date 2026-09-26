import { CompanyPage, companyMetadata } from "@/lib/data/company-page";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return companyMetadata((await params).slug, "agency");
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <CompanyPage slug={slug} entity="agency" />;
}
