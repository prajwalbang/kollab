import Kollab from "@/components/kollab";
import brands from "@/data/brands.json";

export function generateStaticParams() {
  return brands.map((brand) => ({ slug: brand.slug }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <Kollab initialSlug={slug} />;
}
