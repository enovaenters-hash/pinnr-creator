'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabase, supabaseConfigured } from '@/lib/supabase';
import PublicMap, { type PublicVideo } from '@/components/PublicMap';
import { NotConfigured } from '@/components/AuthCard';

/**
 * Fan view: every creator's spots, filterable by creator and category.
 * Deep links: /map?creator=<handle>  and  /map?focus=<video id>
 */
export default function FanMapPage() {
  const [videos, setVideos] = useState<PublicVideo[] | null>(null);
  const [params, setParams] = useState<{ creator: string | null; focus: string | null } | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setParams({ creator: q.get('creator')?.toLowerCase() ?? null, focus: q.get('focus') });
    if (!supabaseConfigured) return;
    getSupabase().from('videos')
      .select('*, creators(tiktok_username, display_name, avatar_url)')
      .eq('hidden', false).not('lat', 'is', null)
      .order('posted_at', { ascending: false }).limit(2000)
      .then(({ data }) => setVideos((data as PublicVideo[]) ?? []));
  }, []);

  function onCreatorChange(handle: string | null) {
    const url = new URL(window.location.href);
    url.searchParams.delete('focus');
    if (handle) url.searchParams.set('creator', handle); else url.searchParams.delete('creator');
    window.history.replaceState(null, '', url);
  }

  if (!supabaseConfigured) return <main className="max-w-xl mx-auto p-6"><NotConfigured /></main>;

  const creatorCount = new Set((videos ?? []).map((v) => v.creator_id)).size;

  return (
    <main className="flex-1 bg-white text-gray-900">
      <div className="max-w-5xl mx-auto px-4 pb-12">
        <header className="py-5 flex items-center justify-between">
          <div>
            <Link href="/" className="text-lg font-semibold">📍 Pinnr</Link>
            {videos && <p className="text-xs text-gray-500">{videos.length} spots from {creatorCount} creators</p>}
          </div>
          <Link href="/" className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 hover:border-gray-400">Home</Link>
        </header>
        {videos === null || params === null
          ? <p className="text-sm text-gray-500">Loading map…</p>
          : <PublicMap videos={videos} creatorFilter initialCreator={params.creator} focusId={params.focus} onCreatorChange={onCreatorChange} />}
      </div>
    </main>
  );
}
