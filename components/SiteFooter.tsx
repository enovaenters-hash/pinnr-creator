import Link from 'next/link';

/** Small footer with the legal links (TikTok's app review wants them visible on the site). */
export default function SiteFooter() {
  return (
    <footer className="bg-cloud text-gray-500 text-xs">
      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>© {new Date().getFullYear()} POVGo</span>
        <Link href="/privacy" className="hover:text-ink underline-offset-2 hover:underline">Privacy Policy</Link>
        <Link href="/terms" className="hover:text-ink underline-offset-2 hover:underline">Terms of Service</Link>
      </div>
    </footer>
  );
}
