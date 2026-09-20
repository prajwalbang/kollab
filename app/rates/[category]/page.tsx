import Kollab from "@/components/kollab";

const categories = ["All categories", "Beauty", "Fashion", "Lifestyle", "Food & drink", "Tech", "Fitness"];

export function generateStaticParams() {
  return categories.map((category) => ({ category }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  return (
    <Kollab initialTab="rates" initialCategory={decodeURIComponent(category)} />
  );
}
