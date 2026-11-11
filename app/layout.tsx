import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pinnr",
  description: "Maps of the places creators post on TikTok",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
