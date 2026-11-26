'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { getSupabase, supabaseConfigured } from '@/lib/supabase';
import { categoryColor } from '@/lib/types';
import type { MapPin } from '@/components/Map';
import type { PublicVideo } from '@/components/PublicMap';
import PosterTile from '@/components/PosterTile';
import SiteNav from '@/components/SiteNav';
import BottomNav from '@/components/BottomNav';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

/** Where an owner asks to claim their page (until claiming is built into the app). */
const CLAIM_EMAIL = 'hello@povgo.app';

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const CAT_LABELS: Record<string, string> = { soulfood: 'Soul Food', bbq: 'BBQ', cafe: 'Café' };
const catLabel = (c: string | null) => (c ? CAT_LABELS[c] ?? c.charAt(0).toUpperCase() + c.slice(1) : '');

function cityOf(addr: string | null): string {
  const parts = (addr ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 3) return `${parts[parts.length - 2]}, ${parts[parts.length - 1].split(' ')[0]}`;
  return parts[parts.length - 1] ?? '';
}

type Location = { key: string; address: string | null; lat: number; lng: number; count: number };

/**
 * Business page: every creator video about one place (matched by name), its locations on a map, and the creators
 * who've been there. The business can sponsor and claim the page, but never edits, hides or reorders the videos.
 */
export default function BusinessPage({ slug }: { slug: string }) {
  const [videos, setVideos] = useState<PublicVideo[] | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured || !slug) { setVideos([]); return; }
    let live = true;
    (async () => {
      // Loose match in the database (letters in order, anything between), exact match on the normalized name here,
      // so "Thai Tanic", "THAITANIC" and "Thaitanic Thai Kitchen" all land on /p/thaitanic.
      const pattern = `%${slug.split('').join('%')}%`;
      const { data } = await getSupabase().from('videos')
        .select('*, creators!inner(tiktok_username, display_name, avatar_url)')
        .eq('hidden', false).ilike('place_name', pattern)
        .order('posted_at', { ascending: false, nullsFirst: false }).limit(200);
      if (!live) return;
      const list = ((data ?? []) as unknown as PublicVideo[]).filter((v) => norm(v.place_name).includes(slug));
      setVideos(list);
      if (list[0]?.place_name) document.title = `${list[0].place_name} · Every creator's POV · POVGo`;
    })();
    return () => { live = false; };
  }, [slug]);

  const name = useMemo(() => {
    // The most common spelling of the name wins.
    const counts: Record<string, number> = {};
    (videos ?? []).forEach((v) => { if (v.place_name) counts[v.place_name] = (counts[v.place_name] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? slug;
  }, [videos, slug]);

  const category = useMemo(() => {
    const counts: Record<string, number> = {};
    (videos ?? []).forEach((v) => { if (v.category) counts[v.category] = (counts[v.category] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [videos]);

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
    const byHandle: Record<string, { handle: string; name: string; avatar: string | null; count: number }> = {};
    (videos ?? []).forEach((v) => {
      const h = v.creators?.tiktok_username;
      if (!h) return;
      byHandle[h] ??= { handle: h, name: v.creators?.display_name || h, avatar: v.creators?.avatar_url ?? null, count: 0 };
      byHandle[h].count++;
    });
    return Object.values(byHandle).sort((a, b) => b.count - a.count);
  }, [videos]);

  const pins = useMemo<MapPin[]>(() => locations.map((l) => ({
    id: l.key, lat: l.lat, lng: l.lng, title: name,
    subtitle: `${l.address ?? ''}${l.address ? ' · ' : ''}${l.count} video${l.count === 1 ? '' : 's'}`,
    color: categoryColor(category),
    href: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(l.address || `${l.lat},${l.lng}`)}`,
  })), [locations, name, category]);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: document.title, url }); return; }
      await navigator.clipboard.writeText(url);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { /* closed the share sheet */ }
  }

  if (videos !== null && videos.length === 0) {
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

  const first = locations[0];
  const directions = first
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(first.address || `${first.lat},${first.lng}`)}`
    : null;
  const subtitle = [category && catLabel(category), first && cityOf(first.address),
    locations.length > 1 ? `${locations.length} locations` : null].filter(Boolean).join(' · ');
  const claimHref = `mailto:${CLAIM_EMAIL}?subject=${encodeURIComponent(`Claim ${name} on POVGo`)}&body=${encodeURIComponent(
    `Hi! I own/manage ${name} and want to claim our POVGo page:\n${typeof window !== 'undefined' ? window.location.href : ''}\n\nName:\nRole:\nPhone:`)}`;

  return (
    <>
      <SiteNav compact />
      <main className="flex-1 bg-cloud text-ink">
        <div className="max-w-5xl mx-auto px-4 pb-28">
          <header className="pt-5 pb-4">
            <p className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-glacier">Every creator&apos;s POV</p>
            <h1 className="mt-1 font-display text-3xl sm:text-5xl font-semibold leading-[1.05] break-words">
              {videos === null ? <span className="inline-block h-9 w-48 rounded bg-white animate-pulse" /> : name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="min-w-0 truncate text-xs sm:text-sm font-bold text-gray-500">
                {videos === null ? <>&nbsp;</> : <>
                  {subtitle}{subtitle ? ' · ' : ''}{videos.length} video{videos.length === 1 ? '' : 's'} from {creators.length} creator{creators.length === 1 ? '' : 's'}
                </>}
              </p>
              <div className="ml-auto flex shrink-0 gap-1.5">
                <button onClick={share} className="btn-ghost px-3 py-1 text-xs">{copied ? 'Copied' : 'Share'}</button>
                {directions && (
                  <a href={directions} target="_blank" rel="noopener" className="btn-sun px-3 py-1 text-xs">Directions</a>
                )}
              </div>
            </div>
          </header>

          {/* Creators who've been here */}
          {creators.length > 0 && (
            <section aria-labelledby="been-here" className="mb-5">
              <h2 id="been-here" className="text-sm font-extrabold text-gray-600 mb-2">Creators who&apos;ve been here</h2>
              <ul className="flex gap-3 overflow-x-auto pb-1">
                {creators.map((c) => (
                  <li key={c.handle} className="shrink-0">
                    <Link href={`/c/${encodeURIComponent(c.handle)}`} className="flex flex-col items-center gap-1 w-16">
                      <span className="relative w-14 h-14 rounded-full bg-frost text-glacier font-display text-xl font-semibold flex items-center justify-center overflow-hidden border-[3px] border-white shadow">
                        {c.handle.charAt(0).toUpperCase()}
                        {c.avatar && (
                          <img src={c.avatar} referrerPolicy="no-referrer" alt=""
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            className="absolute inset-0 w-full h-full object-cover" />
                        )}
                      </span>
                      <span className="w-full truncate text-center text-[10px] font-bold text-gray-600">@{c.handle}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Every video */}
          <section aria-labelledby="povs">
            <h2 id="povs" className="text-xl sm:text-2xl font-semibold mb-3">The POVs</h2>
            {videos === null ? (
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                {Array.from({ length: 6 }, (_, i) => <div key={i} className="rounded-2xl bg-white animate-pulse aspect-[4/5] sm:aspect-[4/3]" />)}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                {videos.map((v) => <PosterTile key={v.id} video={v} />)}
              </div>
            )}
            <p className="mt-2 text-xs font-bold text-gray-500">Posted by creators, newest first. Businesses can&apos;t edit, hide or reorder these.</p>
          </section>

          {/* Where it is */}
          {pins.length > 0 && (
            <section aria-labelledby="where" className="mt-8">
              <h2 id="where" className="text-xl sm:text-2xl font-semibold mb-3">{locations.length > 1 ? 'Locations' : 'Where it is'}</h2>
              <div className="h-64 sm:h-80 rounded-2xl overflow-hidden shadow-[0_6px_20px_rgba(19,41,58,.1)]">
                <Map pins={pins} />
              </div>
              <ul className="mt-2 space-y-1">
                {locations.map((l) => (
                  <li key={l.key} className="text-xs sm:text-sm font-bold text-gray-600 truncate">📍 {l.address || `${l.lat}, ${l.lng}`}</li>
                ))}
              </ul>
            </section>
          )}

          {/* For the owner */}
          <section className="mt-8 card p-5 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <h2 className="font-display text-lg font-semibold">Own {name}?</h2>
              <p className="text-sm text-gray-600">Claim this page to add your hours, menu and a perk for fans, and see how many people saved you or tapped directions. Creator videos always stay as posted.</p>
            </div>
            <a href={claimHref} className="btn-sun px-5 py-2.5 text-sm text-center shrink-0">Claim this page</a>
          </section>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
