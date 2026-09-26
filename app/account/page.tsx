import { EmailAccount } from "@/components/email-account";
export const metadata = { title: "Your account · Kollab", robots: { index: false, follow: false } };
export default function Page() {
  return <main style={{ maxWidth: 520, margin: "60px auto", padding: "24px" }}>
    <a href="/" className="wordmark">kollab.</a>
    <section className="review-card" style={{ marginTop: 30, padding: 28 }}><EmailAccount /></section>
  </main>;
}
