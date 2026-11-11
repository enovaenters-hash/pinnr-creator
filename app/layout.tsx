import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted variable fonts (OFL, from Fontsource) so builds never depend on Google Fonts.
const fredoka = localFont({ src: "./fonts/fredoka.woff2", weight: "300 700", variable: "--font-fredoka", display: "swap" });
const nunito = localFont({ src: "./fonts/nunito.woff2", weight: "200 1000", variable: "--font-nunito", display: "swap" });
const sora = localFont({ src: "./fonts/sora.woff2", weight: "100 800", variable: "--font-sora", display: "swap" });

export const metadata: Metadata = {
  title: "POVGo",
  description: "See the POV. Then go. Every spot your favorite creators post about, on one map.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${fredoka.variable} ${nunito.variable} ${sora.variable}`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
