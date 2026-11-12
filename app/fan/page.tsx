import Link from 'next/link';
import SiteNav from '@/components/SiteNav';

/** Fan login placeholder until fan accounts exist. */
export default function FanLoginPage() {
  return (
    <>
      <SiteNav active="login" />
      <main className="flex-1 flex items-center justify-center px-4 py-12 bg-cloud">
        <div className="card p-7 w-full max-w-sm text-center">
          <h1 className="text-2xl font-semibold text-ink">Fan accounts are coming soon</h1>
          <p className="text-sm text-gray-600 mt-2">You don&apos;t need an account to watch videos and find spots on the map.</p>
          <div className="mt-6 grid gap-2">
            <Link href="/map" className="btn-sun py-3 text-sm">Explore the map</Link>
            <Link href="/dashboard" className="text-sm font-bold text-glacier hover:underline">I&apos;m a creator →</Link>
          </div>
        </div>
      </main>
    </>
  );
}
