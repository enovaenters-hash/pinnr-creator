'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** The creator dashboard now lives in My Spots on the fan page; old links and bookmarks land there. */
export default function DashboardPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/fan?view=myspots'); }, [router]);
  return <main className="flex-1 flex items-center justify-center text-sm text-gray-500">Taking you to My Spots…</main>;
}
