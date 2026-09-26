import { ImageResponse } from "next/og";
import { publicCompany } from "@/lib/data/public-server";
export async function GET(request: Request) {
  try {
    const data = await publicCompany(new URL(request.url).searchParams.get("slug") || "");
    if (!data) return new Response("Not found", { status: 404 });
    const score = data.aggregates?.would_work_again;
    return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: 70, background: "#faf9f1", color: "#292b23", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: "#8a7414" }}>kollab.</div>
      <div style={{ display: "flex", marginTop: 36, fontSize: 60, fontWeight: 700 }}>{data.brand.name}</div>
      <div style={{ display: "flex", marginTop: 30, fontSize: 40 }}>{score == null ? "More creator experiences needed" : `${score}% would work together again`}</div>
      <div style={{ display: "flex", marginTop: 35, fontSize: 28 }}>{data.brand.review_count} published collaboration reports · Check a brand before you sign.</div>
    </div>, { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=0, must-revalidate" } });
  } catch { return new Response("Image unavailable", { status: 503 }); }
}
