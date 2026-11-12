'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabase, supabaseConfigured } from '@/lib/supabase';
import type { Creator, Video } from '@/lib/types';
import SiteNav from '@/components/SiteNav';
import FanMap from '@/components/FanMap';

type Top = Pick<Video, 'id' | 'place_name' | 'address' | 'category' | 'cover_url' | 'video_url' | 'lat' | 'featured' | 'posted_at'>;
const FIELDS = 'id, place_name, address, category, cover_url, video_url, lat, featured, posted_at';

const CAT_LABELS: Record<string, string> = { soulfood: 'Soul Food', bbq: 'BBQ', cafe: 'Café' };
const catLabel = (c: string | null) => (c ? CAT_LABELS[c] ?? c.charAt(0).toUpperCase() + c.slice(1) : '');

function cityOf(addr: string | null): string {
  const parts = (addr ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 3) return `${parts[parts.length - 2]}, ${parts[parts.length - 1].split(' ')[0]}`;
  return parts[parts.length - 1] ?? '';
}

/**
 * Creator page (layout 04 "Ranked Top 3"): the creator's three Top picks in one row with big
 * 1-2-3 numbers, then their map. Tapping a pick opens and plays it in the map's video panel.
 */
export default function CreatorPage({ handle }: { handle: string }) {
  const [creator, setCreator] = useState<Creator | null | undefined>(undefined);
  const [top, setTop] = useState<Top[] | null>(null);
  const [spots, setSpots] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = getSupabase();
    (async () => {
      const { data: c } = await supabase.from('creators').select('*').eq('tiktok_username', handle).maybeSingle();
      setCreator((c as Creator) ?? null);
      if (!c) return;
      document.title = `${c.display_name || c.tiktok_username}'s Top 3 · POVGo`;

      // Top picks first (newest first); fill any empty slots with the newest mapped videos.
      const { data: picks } = await supabase.from('videos').select(FIELDS)
        .eq('creator_id', c.id).eq('hidden', false).eq('featured', true)
        .order('posted_at', { ascending: false }).limit(3);
      let list = (picks as Top[]) ?? [];
      if (list.length < 3) {
        const { data: recent } = await supabase.from('videos').select(FIELDS)
          .eq('creator_id', c.id).eq('hidden', false).not('lat', 'is', null)
          .order('posted_at', { ascending: false }).limit(6);
        const have = new Set(list.map((v) => v.id));
        list = list.concat(((recent as Top[]) ?? []).filter((v) => !have.has(v.id))).slice(0, 3);
      }
      setTop(list);

      const { data: mapped } = await supabase.from('videos').select('address, lat, lng')
        .eq('creator_id', c.id).eq('hidden', false).not('lat', 'is', null);
      const keys = new Set((mapped ?? []).map((r) =>
        (r.address ?? '').toLowerCase().replace(/[^a-z0-9]/g, '') || `${r.lat},${r.lng}`));
      setSpots(keys.size);
    })();
  }, [handle]);

  function open(v: Top) {
    if (v.lat === null) {
      if (v.video_url) window.open(v.video_url, '_blank', 'noopener');
      return;
    }
    // Phones show the video full screen; on a computer bring the map and player into view.
    if (window.matchMedia('(min-width: 761px)').matches) {
      document.getElementById('creator-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    window.dispatchEvent(new CustomEvent('povgo:focus', { detail: { id: v.id, play: true } }));
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: document.title, url }); return; }
      await navigator.clipboard.writeText(url);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { /* closed the share sheet */ }
  }

  if (creator === null) {
    return (
      <>
        <SiteNav />
        <main className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <h1 className="text-2xl font-semibold">We couldn&apos;t find @{handle}</h1>
          <p className="text-gray-600 text-sm">They may not have joined POVGo yet.</p>
          <Link href="/map" className="btn-sun px-6 py-3">Explore the Fan Map</Link>
        </main>
      </>
    );
  }

  const name = creator?.display_name || creator?.tiktok_username || handle;
  const cols = top && top.length ? top.length : 3;

  return (
    <>
      <SiteNav />
      <main className="flex-1 bg-cloud text-ink">
        <div className="max-w-5xl mx-auto px-4 pb-16">
          {/* Who: photo, then name (shrinks to fit one line) over handle + small buttons */}
          <header className="pt-5 pb-4 flex items-center gap-3 sm:gap-4">
            <Avatar creator={creator} handle={handle} />
            <div className="min-w-0 flex-1 [container-type:inline-size]">
              <h1 className="font-display font-semibold leading-[1.1] whitespace-nowrap overflow-hidden text-ellipsis"
                style={{ fontSize: `min(2.25rem, calc(100cqi / ${((name.length + 8) * 0.56).toFixed(2)}))` }}>
                {name}&apos;s Top 3
              </h1>
              <div className="mt-1 flex items-center gap-2">
                <p className="min-w-0 truncate text-[11px] min-[380px]:text-xs sm:text-sm font-bold text-gray-500">
                  @{handle}{spots !== null && <> · {spots} spot{spots === 1 ? '' : 's'}</>}
                </p>
                <div className="ml-auto flex shrink-0 gap-1 sm:gap-1.5">
                  <button onClick={share} className="btn-ghost px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs">{copied ? 'Copied' : 'Share'}</button>
                  <a href={`https://www.tiktok.com/@${encodeURIComponent(handle)}`} target="_blank" rel="noopener"
                    className="btn-sun px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs">▶ TikTok</a>
                </div>
              </div>
            </div>
          </header>

          {/* Top 3, one row, fit to width */}
          {top === null ? (
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {[0, 1, 2].map((i) => <div key={i} className="aspect-[3/4] sm:aspect-[4/5] rounded-xl bg-white animate-pulse" />)}
            </div>
          ) : top.length === 0 ? (
            <p className="card p-5 text-sm text-gray-600">{name} hasn&apos;t added any spots yet.</p>
          ) : (
            <ol className="grid gap-2 sm:gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {top.map((v, i) => (
                <li key={v.id} className="relative min-w-0">
                  <button onClick={() => open(v)} aria-label={`Play #${i + 1}: ${v.place_name || 'spot'}`}
                    className="group relative block w-full aspect-[3/4] sm:aspect-[4/5] rounded-xl overflow-hidden bg-frost shadow-[0_6px_20px_rgba(19,41,58,.1)] text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun">
                    {v.cover_url && (
                      <img src={v.cover_url} referrerPolicy="no-referrer" alt=""
                        onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                    )}
                    <span className="absolute inset-x-0 bottom-0 px-2 sm:px-3 pt-8 pb-2 sm:pb-3 bg-gradient-to-t from-black/80 to-transparent text-white">
                      <span className="block font-display font-semibold text-[13px] sm:text-lg leading-tight truncate">{v.place_name || 'Spot'}</span>
                      <span className="block text-[10px] sm:text-xs font-bold opacity-85 truncate">
                        {[cityOf(v.address), catLabel(v.category)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </button>
                  <span aria-hidden="true"
                    className="pointer-events-none absolute -top-2 sm:-top-4 left-1 sm:left-2 font-display font-bold leading-none text-sun text-[44px] sm:text-[84px] [-webkit-text-stroke:3px_#13293a] [paint-order:stroke] drop-shadow-[0_3px_0_rgba(19,41,58,.25)]">
                    {i + 1}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {/* Their map */}
          <section id="creator-map" className="mt-8 scroll-mt-4">
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 flex flex-wrap items-baseline gap-x-2">
              All of {name}&apos;s spots
              {spots !== null && <span className="text-sm font-bold text-gray-500 font-sans whitespace-nowrap">{spots} on the map</span>}
            </h2>
            <FanMap initialCreator={handle} embedded />
          </section>
        </div>
      </main>
    </>
  );
}

function Avatar({ creator, handle }: { creator: Creator | undefined; handle: string }) {
  const letter = (creator?.display_name || handle).charAt(0).toUpperCase();
  return (
    <div className="relative w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-frost text-glacier font-display text-2xl font-semibold flex items-center justify-center shrink-0 overflow-hidden border-[3px] sm:border-4 border-white shadow">
      {letter}
      {creator?.avatar_url && (
        <img src={creator.avatar_url} referrerPolicy="no-referrer" alt=""
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
          className="absolute inset-0 w-full h-full object-cover" />
      )}
    </div>
  );
}
