'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabase, supabaseConfigured } from '@/lib/supabase';
import type { Creator } from '@/lib/types';
import type { PublicVideo } from '@/components/PublicMap';
import SpotCard from '@/components/SpotCard';
import SiteNav from '@/components/SiteNav';

type NewCreator = Creator & { spots: number };
type Stats = { creators: number | null; fans: number | null; locations: number | null };

const VIDEO_FIELDS = '*, creators(tiktok_username, display_name, avatar_url)';

/** Home screen: choose a view, plus Featured Locations, New POVs and New Creators. */
export default function Home() {
  const [featured, setFeatured] = useState<PublicVideo[] | null>(null);
  const [newPovs, setNewPovs] = useState<PublicVideo[] | null>(null);
  const [newCreators, setNewCreators] = useState<NewCreator[] | null>(null);
  const [stats, setStats] = useState<Stats>({ creators: null, fans: null, locations: null });

  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = getSupabase();

    // Site totals. Creators and locations can be counted straight away; fans (accounts that aren't
    // creators) come from the site_stats() function, which also refreshes all three together.
    supabase.from('creators').select('id', { count: 'exact', head: true })
      .then(({ count }) => { if (count !== null) setStats((s) => ({ ...s, creators: count })); });
    supabase.from('videos').select('id', { count: 'exact', head: true }).eq('hidden', false).not('lat', 'is', null)
      .then(({ count }) => { if (count !== null) setStats((s) => ({ ...s, locations: count })); });
    supabase.rpc('site_stats').then(({ data, error }) => {
      if (!error && data) setStats({ creators: data.creators ?? null, fans: data.fans ?? null, locations: data.locations ?? null });
    });

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
    <>
    <SiteNav active="home" />
    <main className="flex-1 bg-cloud text-ink">
      <div className="max-w-5xl mx-auto px-4 pb-16">
        {/* Hero + view chooser */}
        <header className="pt-12 pb-6">
          {/* Row 1: the tagline, always on a single line */}
          <h1 className="font-display font-bold tracking-tight leading-[1.05] whitespace-nowrap text-[clamp(1.4rem,6.4vw,3.75rem)]">
            Map It. Tap It. <span className="text-glacier">Live It.</span>
          </h1>
          {/* Row 2 */}
          <p className="text-gray-600 mt-3 max-w-xl">A real map of your favorite creators&apos; stops. Tap a pin, watch the video, get directions.</p>
          {/* Row 3 */}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/map" className="btn-sun px-6 py-3">Explore the map</Link>
            <Link href="/dashboard" className="btn-ghost px-6 py-3">I&apos;m a creator</Link>
          </div>
          {/* Row 4: site totals */}
          <dl className="mt-7 grid grid-cols-3 gap-2 sm:gap-3 max-w-xl">
            <Stat label="Total Creators" value={stats.creators} />
            <Stat label="Total Fans" value={stats.fans} />
            <Stat label="Total Locations" value={stats.locations} />
          </dl>
        </header>

        <Section title="Featured Locations" items={featured} empty="No featured spots yet.">
          {featured?.map((v, i) => <SpotCard key={v.id} video={v} badge={`★ Featured #${i + 1}`} />)}
        </Section>

        <Section title="New POVs" items={newPovs} empty="No videos synced yet." moreHref="/map">
          {newPovs?.map((v) => <SpotCard key={v.id} video={v} badge={v.posted_at ? new Date(v.posted_at).toLocaleDateString() : undefined} />)}
        </Section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold mb-3">New Creators</h2>
          {newCreators === null && <Skeleton rows />}
          {newCreators?.length === 0 && <p className="text-sm text-gray-500">No creators yet.</p>}
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {newCreators?.map((c) => (
              <li key={c.id}>
                <Link href={`/c/${c.tiktok_username}`}
                  className="card flex items-center gap-3 p-3 border-2 border-transparent hover:border-ice transition-colors">
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

        <footer className="mt-16 pt-6 border-t border-gray-200 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-semibold text-gray-500">
          <Link href="/signup" className="hover:text-ink">Become a creator</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-ink">Terms of Service</Link>
          <Link href="/admin" className="hover:text-ink">Admin</Link>
        </footer>
      </div>
    </main>
    </>
  );
}

function Section({ title, items, empty, moreHref, children }: {
  title: string; items: unknown[] | null; empty: string; moreHref?: string; children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-2xl font-semibold">{title}</h2>
        {moreHref && <Link href={moreHref} className="text-sm font-bold text-glacier hover:underline">See all →</Link>}
      </div>
      {items === null && <Skeleton />}
      {items?.length === 0 && <p className="text-sm text-gray-500">{empty}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{children}</div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="card px-2 py-3 sm:px-4 sm:py-4 text-center">
      <dd className="font-display text-2xl sm:text-4xl font-bold leading-none text-ink">{value === null ? '—' : value.toLocaleString()}</dd>
      <dt className="mt-1.5 text-[10px] sm:text-xs font-extrabold uppercase tracking-wide text-gray-500">{label}</dt>
    </div>
  );
}

function Avatar({ creator }: { creator: Creator }) {
  const letter = (creator.display_name || creator.tiktok_username).charAt(0).toUpperCase();
  return (
    <div className="relative w-11 h-11 rounded-full bg-frost text-glacier font-bold flex items-center justify-center shrink-0 overflow-hidden">
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
        <div key={i} className={`rounded-xl bg-white animate-pulse ${rows ? 'h-16' : 'aspect-[4/5]'}`} />
      ))}
    </div>
  );
}
