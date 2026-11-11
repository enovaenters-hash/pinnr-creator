'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabase, supabaseConfigured } from '@/lib/supabase';
import type { Creator } from '@/lib/types';
import type { PublicVideo } from '@/components/PublicMap';
import SpotCard from '@/components/SpotCard';

type NewCreator = Creator & { spots: number };

const VIDEO_FIELDS = '*, creators(tiktok_username, display_name, avatar_url)';

/** Home screen: choose a view, plus Featured Locations, New POVs and New Creators. */
export default function Home() {
  const [featured, setFeatured] = useState<PublicVideo[] | null>(null);
  const [newPovs, setNewPovs] = useState<PublicVideo[] | null>(null);
  const [newCreators, setNewCreators] = useState<NewCreator[] | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = getSupabase();

    supabase.from('featured_locations').select(`slot, video:videos(${VIDEO_FIELDS})`).order('slot')
      .then(({ data }) => setFeatured(
        ((data ?? []) as unknown as { video: PublicVideo | null }[])
          .map((r) => r.video).filter((v): v is PublicVideo => Boolean(v && v.lat !== null && !v.hidden)),
      ));

    supabase.from('videos').select(VIDEO_FIELDS)
      .eq('hidden', false).not('lat', 'is', null)
      .order('created_at', { ascending: false }).order('posted_at', { ascending: false }).limit(3)
      .then(({ data }) => setNewPovs((data as PublicVideo[]) ?? []));

    (async () => {
      const { data } = await supabase.from('creators').select('*').order('created_at', { ascending: false }).limit(3);
      const rows = (data as Creator[]) ?? [];
      const withCounts = await Promise.all(rows.map(async (c) => {
        const { count } = await supabase.from('videos').select('id', { count: 'exact', head: true })
          .eq('creator_id', c.id).eq('hidden', false).not('lat', 'is', null);
        return { ...c, spots: count ?? 0 };
      }));
      setNewCreators(withCounts);
    })();
  }, []);

  return (
    <main className="flex-1 bg-white text-gray-900">
      <div className="max-w-5xl mx-auto px-4 pb-16">
        {/* Hero + view chooser */}
        <header className="pt-10 pb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">📍 Pinnr</h1>
          <p className="text-gray-500 mt-2">Every spot your favorite creators post about, on one map.</p>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
            <Link href="/map" className="py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700">
              Explore the map
            </Link>
            <Link href="/dashboard" className="py-3 rounded-lg border border-gray-300 font-semibold hover:border-gray-500">
              I&apos;m a creator
            </Link>
          </div>
        </header>

        <Section title="Featured Locations" items={featured} empty="No featured spots yet.">
          {featured?.map((v, i) => <SpotCard key={v.id} video={v} badge={`★ Featured #${i + 1}`} />)}
        </Section>

        <Section title="New POVs" items={newPovs} empty="No videos synced yet." moreHref="/map">
          {newPovs?.map((v) => <SpotCard key={v.id} video={v} badge={v.posted_at ? new Date(v.posted_at).toLocaleDateString() : undefined} />)}
        </Section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold mb-3">New Creators</h2>
          {newCreators === null && <Skeleton rows />}
          {newCreators?.length === 0 && <p className="text-sm text-gray-500">No creators yet.</p>}
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {newCreators?.map((c) => (
              <li key={c.id}>
                <Link href={`/map?creator=${c.tiktok_username}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-gray-400">
                  <Avatar creator={c} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{c.display_name || c.tiktok_username}</p>
                    <p className="text-xs text-gray-500 truncate">@{c.tiktok_username} · {c.spots} spot{c.spots === 1 ? '' : 's'}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-16 pt-6 border-t border-gray-100 flex justify-center gap-6 text-xs text-gray-400">
          <Link href="/signup" className="hover:text-gray-700">Become a creator</Link>
          <Link href="/admin" className="hover:text-gray-700">Admin</Link>
        </footer>
      </div>
    </main>
  );
}

function Section({ title, items, empty, moreHref, children }: {
  title: string; items: unknown[] | null; empty: string; moreHref?: string; children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {moreHref && <Link href={moreHref} className="text-sm text-blue-600">See all →</Link>}
      </div>
      {items === null && <Skeleton />}
      {items?.length === 0 && <p className="text-sm text-gray-500">{empty}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{children}</div>
    </section>
  );
}

function Avatar({ creator }: { creator: Creator }) {
  const letter = (creator.display_name || creator.tiktok_username).charAt(0).toUpperCase();
  return (
    <div className="relative w-11 h-11 rounded-full bg-blue-100 text-blue-700 font-semibold flex items-center justify-center shrink-0 overflow-hidden">
      {letter}
      {creator.avatar_url && (
        <img src={creator.avatar_url} referrerPolicy="no-referrer" alt=""
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
          className="absolute inset-0 w-full h-full object-cover" />
      )}
    </div>
  );
}

function Skeleton({ rows }: { rows?: boolean }) {
  return (
    <div className={`grid gap-3 ${rows ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
      {[0, 1, 2].map((i) => (
        <div key={i} className={`rounded-xl bg-gray-100 animate-pulse ${rows ? 'h-16' : 'aspect-[4/5]'}`} />
      ))}
    </div>
  );
}
