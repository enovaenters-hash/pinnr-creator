'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { getSupabase, supabaseConfigured } from '@/lib/supabase';
import { categoryColor } from '@/lib/types';
import type { MapPin } from '@/components/Map';
import SiteNav from '@/components/SiteNav';
import BottomNav from '@/components/BottomNav';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

export interface PreviewMapInfo { handle: string; display_name: string | null; avatar_url: string | null; updated_at?: string }
export interface PreviewSpot {
  id: string; handle: string; tiktok_id: string; caption: string | null; cover_url: string | null; video_url: string | null;
  posted_at: string | null; place_name: string | null; address: string | null; lat: number | null; lng: number | null;
  category: string | null; hidden: boolean;
}

const directionsTo = (s: PreviewSpot) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.address || `${s.lat},${s.lng}`)}`;

/**
 * A map POVGo made for a creator who isn't on POVGo yet: their @tag, every spot from their recent videos on a map,
 * and buttons to watch, get directions, share, or claim the map. Not listed anywhere in the app.
 */
export default function PreviewMap({ handle }: { handle: string }) {
  const [info, setInfo] = useState<PreviewMapInfo | null | undefined>(undefined);
  const [spots, setSpots] = useState<PreviewSpot[]>([]);
  const [focus, setFocus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured || !handle) { setInfo(null); return; }
    let live = true;
    (async () => {
      const sb = getSupabase();
      const [m, s] = await Promise.all([
        sb.from('preview_maps').select('*').eq('handle', handle).maybeSingle(),
        sb.from('preview_spots').select('*').eq('handle', handle).eq('hidden', false).not('lat', 'is', null)
          .order('posted_at', { ascending: false, nullsFirst: false }),
      ]);
      if (!live) return;
      setInfo((m.data as PreviewMapInfo) ?? null);
      setSpots((s.data as PreviewSpot[]) ?? []);
      if (m.data) document.title = `@${handle}'s map · POVGo`;
    })();
    return () => { live = false; };
  }, [handle]);

  const pins = useMemo<MapPin[]>(() => spots.map((s) => ({
    id: s.id, lat: s.lat!, lng: s.lng!, title: s.place_name || 'Spot', subtitle: s.address,
    cover: s.cover_url, href: s.video_url, color: categoryColor(s.category),
  })), [spots]);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: document.title, url }); return; }
      await navigator.clipboard.writeText(url);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { /* closed the share sheet */ }
  }

  function show(id: string) {
    setFocus(id);
    document.getElementById('preview-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (info === null) {
    return (
      <>
        <SiteNav />
        <main className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <h1 className="text-2xl font-semibold">This map isn&apos;t here</h1>
          <Link href="/" className="btn-sun px-6 py-3">Explore POVGo</Link>
        </main>
      </>
    );
  }

  const letter = handle.charAt(0).toUpperCase();
  return (
    <>
      <SiteNav compact />
      <main className="flex-1 bg-cloud text-ink">
        <div className="max-w-5xl mx-auto px-4 pb-28">
          {/* Their tag */}
          <header className="pt-5 pb-3 flex items-center gap-3 sm:gap-4">
            <div className="relative w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-frost text-glacier font-display text-2xl font-semibold flex items-center justify-center shrink-0 overflow-hidden border-[3px] sm:border-4 border-white shadow">
              {letter}
              {info?.avatar_url && (
                <img src={info.avatar_url} referrerPolicy="no-referrer" alt=""
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} className="absolute inset-0 w-full h-full object-cover" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-glacier">A POVGo map for</p>
              <h1 className="font-display text-2xl sm:text-4xl font-semibold leading-tight truncate">@{handle}</h1>
              <p className="text-xs sm:text-sm font-bold text-gray-500">
                {info === undefined ? <>&nbsp;</> : <>{spots.length} spot{spots.length === 1 ? '' : 's'} from their videos</>}
              </p>
            </div>
          </header>

          {/* Buttons */}
          <nav aria-label="Map actions" className="mb-3 flex flex-wrap gap-2">
            <a href={`https://www.tiktok.com/@${encodeURIComponent(handle)}`} target="_blank" rel="noopener" className="btn-ghost px-4 py-1.5 text-xs sm:text-sm">▶ @{handle} on TikTok</a>
            <button onClick={share} className="btn-ghost px-4 py-1.5 text-xs sm:text-sm">{copied ? 'Link copied' : 'Share'}</button>
            <Link href="/signup?as=creator" className="btn-sun px-4 py-1.5 text-xs sm:text-sm">Is this you? Claim your map</Link>
          </nav>

          {/* Map */}
          <section id="preview-map" aria-label={`@${handle}'s map`} className="scroll-mt-4">
            <div className="h-[55vh] min-h-[300px] rounded-2xl overflow-hidden shadow-[0_6px_20px_rgba(19,41,58,.1)] bg-frost">
              {spots.length > 0 && <Map pins={pins} focusId={focus} />}
            </div>
          </section>

          {/* Spots, each with watch + directions */}
          {spots.length > 0 && (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {spots.map((s) => (
                <li key={s.id} className="card p-2 flex items-center gap-3">
                  <button onClick={() => show(s.id)} className="relative w-14 h-16 shrink-0 rounded-lg overflow-hidden bg-frost" aria-label={`Show ${s.place_name || 'spot'} on the map`}>
                    {s.cover_url && <img src={s.cover_url} referrerPolicy="no-referrer" alt="" className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />}
                  </button>
                  <button onClick={() => show(s.id)} className="min-w-0 flex-1 text-left">
                    <span className="block font-bold truncate">{s.place_name || 'Spot'}</span>
                    <span className="block text-xs text-gray-500 truncate">{s.address}</span>
                  </button>
                  <div className="flex flex-col gap-1 shrink-0">
                    {s.video_url && <a href={s.video_url} target="_blank" rel="noopener" className="btn-ghost px-2.5 py-0.5 text-[11px] text-center">▶ Watch</a>}
                    <a href={directionsTo(s)} target="_blank" rel="noopener" className="btn-sun px-2.5 py-0.5 text-[11px] text-center">Directions</a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
