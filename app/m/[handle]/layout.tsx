import type { Metadata } from 'next';

// Preview maps are shared by link only: keep them out of search engines.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PreviewMapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
