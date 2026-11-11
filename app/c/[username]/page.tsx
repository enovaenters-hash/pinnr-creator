'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getSupabase, supabaseConfigured } from '@/lib/supabase';
import type { Creator } from '@/lib/types';
import PublicMap, { type PublicVideo } from '@/components/PublicMap';
import { NotConfigured } from '@/components/AuthCard';

/** Public map for one creator: pinnr.app/c/<tiktok username> */
export default function CreatorMapPage() {
  const { username } = useParams<{ username: string }>();
  const handle = decodeURIComponent(username ?? '').replace(/^@/, '').toLowerCase();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [videos, setVideos] = useState<PublicVideo[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    if (!supabaseConfigured) return;
    (async () => {
      const supabase = getSupabase();
      const { data: c } = await supabase.from('creators').select('*').eq('tiktok_username', handle).maybeSingle();
      if (!c) { setState('missing'); return; }
      const { data: v } = await supabase.from('videos').select('*')
        .eq('creator_id', c.id).eq('hidden', false).not('lat', 'is', null)
        .order('featured', { ascending: false }).order('posted_at', { ascending: false });
      setCreator(c as Creator);
      setVideos((v as PublicVideo[]) ?? []);
      setState('ready');
    })();
  }, [handle]);

  if (!supabaseConfigured) return <main className="max-w-xl mx-auto p-6"><NotConfigured /></main>;

  return (
    <main className="flex-1 bg-white text-gray-900">
      <div className="max-w-5xl mx-auto px-4 pb-12">
        <header className="py-5 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate">
              {creator?.display_name || `@${handle}`}
              <span className="ml-2 text-sm font-normal text-gray-500">@{handle}</span>
            </h1>
            {state === 'ready' && <p className="text-xs text-gray-500">{videos.length} spots on the map</p>}
          </div>
          <a href={`https://www.tiktok.com/@${handle}`} target="_blank" rel="noopener"
            className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 hover:border-gray-400">TikTok ↗</a>
        </header>

        {state === 'loading' && <p className="text-sm text-gray-500">Loading map…</p>}
        {state === 'missing' && (
          <p className="text-sm text-gray-600">No Pinnr map for @{handle} yet. <Link href="/map" className="text-blue-600">See all creators →</Link></p>
        )}
        {state === 'ready' && <PublicMap videos={videos} />}
      </div>
    </main>
  );
}
