'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { getSupabase, supabaseConfigured } from '@/lib/supabase';
import type { Creator } from '@/lib/types';
import type { PublicVideo } from '@/components/PublicMap';
import PosterTile from '@/components/PosterTile';
import ExploreVideos from '@/components/ExploreVideos';
import SiteNav from '@/components/SiteNav';
import BottomNav from '@/components/BottomNav';

// The home map is the same map the old /map page had (pins open the video), starting on Phoenix.
const FanMap = dynamic(() => import('@/components/FanMap'), { ssr: false });
const PHOENIX = { center: [33.4484, -112.074] as [number, number], zoom: 10 };

type NewCreator = Creator & { spots: number };
type Stats = { creators: number | null; fans: number | null; locations: number | null };

const VIDEO_FIELDS = '*, creators(tiktok_username, display_name, avatar_url)';
// The map + Explore grid also need each creator's content types. content_types only exists once multi-types.sql
// has been run, so fall back to the older single column rather than lose the map.
const VIDEO_FIELDS_TYPES = '*, creators(tiktok_username, display_name, avatar_url, content_type, content_types)';
const VIDEO_FIELDS_TYPES_OLD = '*, creators(tiktok_username, display_name, avatar_url, content_type)';

/** Home screen: choose a view, plus Featured Locations, New POVs and New Creators. */
export default function Home() {
  const [featured, setFeatured] = useState<PublicVideo[] | null>(null);
  const [newPovs, setNewPovs] = useState<PublicVideo[] | null>(null);
  const [newCreators, setNewCreators] = useState<NewCreator[] | null>(null);
  /** "See all" on New Creators: every creator, newest first. Loaded the first time it's opened. */
  const [allCreators, setAllCreators] = useState<Creator[] | null>(null);
  const [showAllCreators, setShowAllCreators] = useState(false);
  const [mapVideos, setMapVideos] = useState<PublicVideo[] | null>(null);
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

    const loadAll = (fields: string) => supabase.from('videos').select(fields).eq('hidden', false).not('lat', 'is', null)
      .order('created_at', { ascending: false }).order('posted_at', { ascending: false }).limit(1000);
    loadAll(VIDEO_FIELDS_TYPES).then(async ({ data, error }) => {
      if (error) ({ data } = await loadAll(VIDEO_FIELDS_TYPES_OLD));
      setMapVideos((data as unknown as PublicVideo[]) ?? []);
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

  async function toggleAllCreators() {
    const next = !showAllCreators;
    setShowAllCreators(next);
    if (next && allCreators === null && supabaseConfigured) {
      const { data } = await getSupabase().from('creators').select('*').order('created_at', { ascending: false }).limit(500);
      setAllCreators((data as Creator[]) ?? []);
    }
  }

  // Spot counts for the full list come from the map videos already loaded, so "See all" costs one query.
  const creatorList: NewCreator[] | null = useMemo(() => {
    if (!showAllCreators) return newCreators;
    if (allCreators === null) return null;
    const counts = new Map<string, number>();
    for (const v of mapVideos ?? []) counts.set(v.creator_id, (counts.get(v.creator_id) ?? 0) + 1);
    return allCreators.map((c) => ({ ...c, spots: counts.get(c.id) ?? 0 }));
  }, [showAllCreators, newCreators, allCreators, mapVideos]);

  return (
    <>
    <SiteNav active="home" />
    <main className="flex-1 bg-cloud text-ink">
      <div className="max-w-5xl mx-auto px-4 pb-28">
        {/* Hero: tagline, then stats + Phoenix map + newest pins */}
        <header className="pt-8 sm:pt-12 pb-2">
          <h1 className="font-display font-bold tracking-tight leading-[1.05] whitespace-nowrap text-[clamp(1.4rem,6.4vw,3.75rem)]">
            Map It. Tap It. <span className="text-glacier">Live It.</span>
          </h1>

          <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-x-6">
            {/* Stats: one strip on phones, stacked rows on desktop */}
            <dl className="card grid grid-cols-3 divide-x-2 divide-gray-100 lg:col-start-2 lg:row-start-1 lg:grid-cols-1 lg:divide-x-0 lg:divide-y-2 self-start">
              <Stat label="Total Creators" value={stats.creators} />
              <Stat label="Total Fans" value={stats.fans} />
              <Stat label="Total Locations" value={stats.locations} />
            </dl>

            {/* Phoenix content map */}
            <div className="relative h-[46vh] min-h-[320px] max-h-[520px] lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:h-full lg:max-h-none lg:min-h-[460px]">
              <FanMap home view={PHOENIX} />
            </div>

            {/* Newest pins: a swipe row on phones, a list beside the map on desktop */}
            <div className="lg:col-start-2 lg:row-start-2">
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-[11px] font-extrabold uppercase tracking-widest text-gray-500">New POVs</p>
                <Link href="/#explore" className="text-xs font-bold text-glacier hover:underline">See all →</Link>
              </div>
              {newPovs === null && <div className="h-16 rounded-2xl bg-white animate-pulse" />}
              {newPovs?.length === 0 && <p className="text-sm text-gray-500">No videos synced yet.</p>}
              <div className="flex gap-2.5 overflow-x-auto -mx-4 px-4 pb-1 lg:mx-0 lg:px-0 lg:flex-col lg:overflow-visible">
                {newPovs?.map((v) => <PovMini key={v.id} video={v} />)}
              </div>
            </div>
          </div>
        </header>

        {/* POVGo Featured: the 3 featured slots, always on one line */}
        <section id="explore" className="mt-10 scroll-mt-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-2xl font-semibold">POVGo Featured</h2>
            <Link href="/" className="text-sm font-bold text-glacier hover:underline">See on map →</Link>
          </div>
          {featured === null && (
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {[0, 1, 2].map((i) => <div key={i} className="rounded-2xl bg-white animate-pulse aspect-[4/5] sm:aspect-[4/3]" />)}
            </div>
          )}
          {featured?.length === 0 && <p className="text-sm text-gray-500">No featured spots yet.</p>}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {featured?.slice(0, 3).map((v, i) => <PosterTile key={v.id} video={v} rank={i + 1} />)}
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-2xl font-semibold">{showAllCreators ? 'All Creators' : 'New Creators'}</h2>
            <button type="button" onClick={toggleAllCreators} aria-expanded={showAllCreators}
              className="text-sm font-bold text-glacier hover:underline">
              {showAllCreators ? 'Show less' : 'See all →'}
            </button>
          </div>
          {creatorList === null && <Skeleton rows />}
          {creatorList?.length === 0 && <p className="text-sm text-gray-500">No creators yet.</p>}
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {creatorList?.map((c) => (
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

        <ExploreVideos videos={mapVideos} />

        <footer className="mt-16 pt-6 border-t border-gray-200 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-semibold text-gray-500">
          <Link href="/signup" className="hover:text-ink">Become a creator</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-ink">Terms of Service</Link>
          <Link href="/admin" className="hover:text-ink">Admin</Link>
        </footer>
      </div>
    </main>
    <BottomNav active="explore" />
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex flex-col items-center px-1 py-3 text-center lg:flex-row-reverse lg:justify-between lg:px-5 lg:py-3.5 lg:text-left">
      <dd className="font-display text-2xl sm:text-3xl font-bold leading-none text-ink">{value === null ? '—' : value.toLocaleString()}</dd>
      <dt className="mt-1.5 lg:mt-0 text-[10px] sm:text-xs font-extrabold uppercase tracking-wide text-gray-500">{label}</dt>
    </div>
  );
}

function PovMini({ video }: { video: PublicVideo }) {
  return (
    <Link href={`/?focus=${video.id}`}
      className="card flex w-[220px] shrink-0 items-center gap-3 p-2.5 border-2 border-transparent hover:border-ice transition-colors lg:w-auto">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-ice to-frost">
        {video.cover_url && (
          <img src={video.cover_url} referrerPolicy="no-referrer" alt=""
            onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
            className="absolute inset-0 h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0">
        <p className="font-display text-base font-semibold leading-tight truncate">{video.place_name || 'Spot'}</p>
        <p className="text-xs font-bold text-gray-500 truncate">
          {[video.category, video.creators ? `@${video.creators.tiktok_username}` : null].filter(Boolean).join(' · ')}
        </p>
      </div>
    </Link>
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
