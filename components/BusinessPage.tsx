'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { getSupabase, supabaseConfigured } from '@/lib/supabase';
import { categoryColor } from '@/lib/types';
import { fetchBusinessVideos, type BusinessInfo } from '@/lib/business';
import type { MapPin } from '@/components/Map';
import type { PublicVideo } from '@/components/PublicMap';
import PosterTile from '@/components/PosterTile';
import SiteNav from '@/components/SiteNav';
import BottomNav from '@/components/BottomNav';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

const CAT_LABELS: Record<string, string> = { soulfood: 'Soul Food', bbq: 'BBQ', cafe: 'Café' };
const catLabel = (c: string | null) => (c ? CAT_LABELS[c] ?? c.charAt(0).toUpperCase() + c.slice(1) : '');

function cityOf(addr: string | null | undefined): string {
  const parts = (addr ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 3) return `${parts[parts.length - 2]}, ${parts[parts.length - 1].split(' ')[0]}`;
  return parts[parts.length - 1] ?? '';
}

const directionsTo = (dest: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
const mostCommon = (xs: (string | null | undefined)[]) => {
  const counts: Record<string, number> = {};
  xs.forEach((x) => { if (x) counts[x] = (counts[x] ?? 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

type Location = { key: string; address: string | null; lat: number; lng: number; count: number };

/**
 * Business page /p/<slug>: name, bio, address and website (set in Admin > Business Pages), the Top 3, a map of the
 * location, every creator's video in a carousel, and the creators who've been there. Businesses never edit, hide or
 * reorder creator videos; the Top 3 only highlights three of them.
 */
export default function BusinessPage({ slug }: { slug: string }) {
  const [info, setInfo] = useState<BusinessInfo | null | undefined>(undefined);
  const [videos, setVideos] = useState<PublicVideo[] | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured || !slug) { setInfo(null); setVideos([]); return; }
    let live = true;
    (async () => {
      const sb = getSupabase();
      // Works before business-pages.sql has been run too: then the page just matches by the link's name.
      const { data } = await sb.from('business_pages').select('*').eq('slug', slug).maybeSingle();
      const row = (data as BusinessInfo | null) ?? null;
      const list = await fetchBusinessVideos(sb, row?.match_key || slug);
      if (!live) return;
      setInfo(row);
      setVideos(list);
    })();
    return () => { live = false; };
  }, [slug]);

  const name = info?.name || mostCommon((videos ?? []).map((v) => v.place_name)) || slug;
  const category = useMemo(() => mostCommon((videos ?? []).map((v) => v.category)), [videos]);
  useEffect(() => { if (videos?.length) document.title = `${name} · Every creator's POV · POVGo`; }, [name, videos]);

  const locations = useMemo<Location[]>(() => {
    const byKey: Record<string, Location> = {};
    (videos ?? []).forEach((v) => {
      if (v.lat === null || v.lng === null) return;
      const key = `${v.lat.toFixed(3)},${v.lng.toFixed(3)}`; // ~100 m: same building
      byKey[key] ??= { key, address: v.address, lat: v.lat, lng: v.lng, count: 0 };
      byKey[key].count++;
    });
    return Object.values(byKey).sort((a, b) => b.count - a.count);
  }, [videos]);

  const creators = useMemo(() => {
    const byHandle: Record<string, { handle: string; avatar: string | null; count: number }> = {};
    (videos ?? []).forEach((v) => {
      const h = v.creators?.tiktok_username;
      if (!h) return;
      byHandle[h] ??= { handle: h, avatar: v.creators?.avatar_url ?? null, count: 0 };
      byHandle[h].count++;
    });
    return Object.values(byHandle).sort((a, b) => b.count - a.count);
  }, [videos]);

  // The admin's picks in their order, then the newest videos to fill any empty slots.
  const top = useMemo(() => {
    const list = videos ?? [];
    const picked = (info?.top_video_ids ?? []).map((id) => list.find((v) => v.id === id)).filter(Boolean) as PublicVideo[];
    const have = new Set(picked.map((v) => v.id));
    return picked.concat(list.filter((v) => !have.has(v.id))).slice(0, 3);
  }, [videos, info]);

  const first = locations[0];
  const address = info?.address || first?.address || '';
  const directions = address ? directionsTo(address) : first ? directionsTo(`${first.lat},${first.lng}`) : null;

  const pins = useMemo<MapPin[]>(() => locations.map((l) => ({
    id: l.key, lat: l.lat, lng: l.lng, title: name,
    subtitle: `${l.count} video${l.count === 1 ? '' : 's'}`,
    color: categoryColor(category),
    href: directionsTo(l.address || `${l.lat},${l.lng}`),
  })), [locations, name, category]);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: document.title, url }); return; }
      await navigator.clipboard.writeText(url);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { /* closed the share sheet */ }
  }

  if (videos !== null && videos.length === 0 && !info) {
    return (
      <>
        <SiteNav />
        <main className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <h1 className="text-2xl font-semibold">No creator videos for this spot yet</h1>
          <p className="text-gray-600 text-sm">Once a creator posts about it, every POV shows up here.</p>
          <Link href="/" className="btn-sun px-6 py-3">Explore POVGo</Link>
        </main>
      </>
    );
  }

  const loading = videos === null;
  const meta = [category && catLabel(category), cityOf(address),
    !loading ? `${videos.length} video${videos.length === 1 ? '' : 's'} · ${creators.length} creator${creators.length === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <>
      <SiteNav compact />
      <main className="flex-1 bg-cloud text-ink">
        <div className="max-w-5xl mx-auto px-4 pb-28">
          {/* Who */}
          <header className="pt-5 pb-4">
            <p className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-glacier">Every creator&apos;s POV</p>
            <h1 className="mt-1 font-display text-3xl sm:text-5xl font-semibold leading-[1.05] break-words">
              {loading ? <span className="inline-block h-9 w-48 rounded bg-white animate-pulse" /> : name}
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm font-bold text-gray-500">{meta || <>&nbsp;</>}</p>
            {info?.bio && <p className="mt-3 text-sm sm:text-base font-bold text-gray-700 whitespace-pre-line break-words">{info.bio}</p>}
            {address && (
              <a href={directions ?? '#'} target="_blank" rel="noopener" className="mt-2 inline-block text-sm font-bold text-glacier hover:underline">
                📍 {address}
              </a>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {directions && <a href={directions} target="_blank" rel="noopener" className="btn-sun px-4 py-1.5 text-xs sm:text-sm">Directions</a>}
              {info?.website && <a href={info.website} target="_blank" rel="noopener" className="btn-ghost px-4 py-1.5 text-xs sm:text-sm">Website ↗</a>}
              <button onClick={share} className="btn-ghost px-4 py-1.5 text-xs sm:text-sm">{copied ? 'Copied' : 'Share'}</button>
            </div>
          </header>

          {/* Top 3 */}
          {(loading || top.length > 0) && (
            <section aria-labelledby="top3">
              <h2 id="top3" className="text-xl sm:text-2xl font-semibold mb-3">Top {top.length || 3}</h2>
              <ol className="grid gap-2 sm:gap-4" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                {loading
                  ? [0, 1, 2].map((i) => <li key={i} className="aspect-[3/4] sm:aspect-[4/5] rounded-xl bg-white animate-pulse" />)
                  : top.map((v, i) => (
                    <li key={v.id} className="relative min-w-0">
                      <a href={v.video_url || `/?focus=${v.id}`} target={v.video_url ? '_blank' : undefined} rel="noopener"
                        aria-label={`Play #${i + 1}${v.creators?.tiktok_username ? ` by @${v.creators.tiktok_username}` : ''}`}
                        className="group relative block w-full aspect-[3/4] sm:aspect-[4/5] rounded-xl overflow-hidden bg-frost shadow-[0_6px_20px_rgba(19,41,58,.1)]">
                        {v.cover_url && (
                          <img src={v.cover_url} referrerPolicy="no-referrer" alt=""
                            onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                        )}
                        <span className="absolute inset-x-0 bottom-0 px-2 sm:px-3 pt-8 pb-2 sm:pb-3 bg-gradient-to-t from-black/80 to-transparent text-white">
                          <span className="block text-[11px] sm:text-sm font-extrabold truncate">@{v.creators?.tiktok_username}</span>
                        </span>
                      </a>
                      <span aria-hidden="true"
                        className="pointer-events-none absolute -top-2 sm:-top-4 left-1 sm:left-2 font-display font-bold leading-none text-sun text-[44px] sm:text-[84px] [-webkit-text-stroke:3px_#13293a] [paint-order:stroke] drop-shadow-[0_3px_0_rgba(19,41,58,.25)]">
                        {i + 1}
                      </span>
                    </li>
                  ))}
              </ol>
            </section>
          )}

          {/* Where it is */}
          {pins.length > 0 && (
            <section aria-label="Map" className="mt-6">
              <div className="h-56 sm:h-80 rounded-2xl overflow-hidden shadow-[0_6px_20px_rgba(19,41,58,.1)]">
                <Map pins={pins} />
              </div>
            </section>
          )}

          {/* Every video, side to side */}
          {!loading && videos.length > 0 && (
            <section aria-labelledby="povs" className="mt-6">
              <h2 id="povs" className="text-xl sm:text-2xl font-semibold mb-3">All the POVs <span className="text-gray-400 text-base">({videos.length})</span></h2>
              <div role="region" aria-label="All creator videos" tabIndex={0}
                className="-mx-4 px-4 flex gap-2 sm:gap-4 overflow-x-auto snap-x snap-mandatory pb-2 focus-visible:outline-2 focus-visible:outline-ice">
                {videos.map((v) => (
                  <div key={v.id} className="snap-start shrink-0 w-[38%] sm:w-[23%]"><PosterTile video={v} /></div>
                ))}
              </div>
              <p className="mt-1 text-xs font-bold text-gray-500">Posted by creators, newest first. Businesses can&apos;t edit or hide these.</p>
            </section>
          )}

          {/* Creators who've been here, side to side */}
          {creators.length > 0 && (
            <section aria-labelledby="been-here" className="mt-6">
              <h2 id="been-here" className="text-xl sm:text-2xl font-semibold mb-3">Creators who&apos;ve been here</h2>
              <ul className="-mx-4 px-4 flex gap-4 overflow-x-auto pb-2">
                {creators.map((c) => (
                  <li key={c.handle} className="shrink-0">
                    <Link href={`/c/${encodeURIComponent(c.handle)}`} className="flex flex-col items-center gap-1 w-[72px]">
                      <span className="relative w-16 h-16 rounded-full bg-frost text-glacier font-display text-xl font-semibold flex items-center justify-center overflow-hidden border-[3px] border-white shadow">
                        {c.handle.charAt(0).toUpperCase()}
                        {c.avatar && (
                          <img src={c.avatar} referrerPolicy="no-referrer" alt=""
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            className="absolute inset-0 w-full h-full object-cover" />
                        )}
                      </span>
                      <span className="w-full truncate text-center text-[11px] font-bold text-gray-600">@{c.handle}</span>
                      <span className="text-[10px] font-bold text-gray-400">{c.count} video{c.count === 1 ? '' : 's'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
