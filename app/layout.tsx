import type { Metadata } from "next";
import "./globals.css";
import "./glass.css";
import "./wordmark-backdrop.css";
import "./operations.css";
export const metadata: Metadata = {
  title: "Kollab — Check a brand before you sign.",
  description:
    "The inside word on brand collaborations. Honest, anonymous reviews from Indian creators.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light">
      <body>
        <div className="brand-backdrop" aria-hidden="true">
          <span>kollab.</span>
        </div>
        {children}
      </body>
    </html>
  );
}
