'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabase, supabaseConfigured } from '@/lib/supabase';
import PublicMap, { type PublicVideo } from '@/components/PublicMap';
import { NotConfigured } from '@/components/AuthCard';

/** Combined map of every creator's spots. */
export default function CombinedMapPage() {
  const [videos, setVideos] = useState<PublicVideo[] | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    getSupabase().from('videos')
      .select('*, creators(tiktok_username)')
      .eq('hidden', false).not('lat', 'is', null)
      .order('posted_at', { ascending: false }).limit(2000)
      .then(({ data }) => setVideos((data as PublicVideo[]) ?? []));
  }, []);

  if (!supabaseConfigured) return <main className="max-w-xl mx-auto p-6"><NotConfigured /></main>;

  const creatorCount = new Set((videos ?? []).map((v) => v.creator_id)).size;

  return (
    <main className="flex-1 bg-white text-gray-900">
      <div className="max-w-5xl mx-auto px-4 pb-12">
        <header className="py-5 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">📍 Pinnr map</h1>
            {videos && <p className="text-xs text-gray-500">{videos.length} spots from {creatorCount} creators</p>}
          </div>
          <Link href="/dashboard" className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 hover:border-gray-400">
            Creator login
          </Link>
        </header>
        {videos === null ? <p className="text-sm text-gray-500">Loading map…</p> : <PublicMap videos={videos} showCreator />}
      </div>
    </main>
  );
}
