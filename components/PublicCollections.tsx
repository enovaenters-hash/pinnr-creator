'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { getSupabase } from '@/lib/supabase';
import type { Creator } from '@/lib/types';
import type { MapPin } from '@/components/Map';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

type Spot = {
  id: string; collection_id: string | null; collection_name: string | null; place_name: string | null; address: string | null;
  cover_url: string | null; video_url: string | null; lat: number | null; lng: number | null;
};
type Col = { key: string; name: string; spots: Spot[] };

const PALETTE = ['#e8590c', '#2fb77a', '#8a5cf0', '#e05aa8', '#0ea5a4', '#d9480f', '#4263eb', '#a8872c'];

/**
 * On a creator's page: the TikTok collections they imported and made public, each with a map and its spots.
 * Renders nothing when there are none (or the imports table isn't set up yet).
 */
export default function PublicCollections({ creator }: { creator: Creator }) {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getSupabase().from('imported_spots')
      .select('id, collection_id, collection_name, place_name, address, cover_url, video_url, lat, lng')
      .eq('user_id', creator.id).eq('is_public', true).order('created_at', { ascending: true }).limit(1000)
      .then(({ data, error }) => { if (live && !error) setSpots((data ?? []) as Spot[]); });
    return () => { live = false; };
  }, [creator.id]);

  const cols: Col[] = useMemo(() => {
    const m = new globalThis.Map<string, Col>();
    for (const s of spots) {
      const key = s.collection_id ?? s.collection_name ?? 'tiktok';
      const c = m.get(key) ?? { key, name: s.collection_name || 'Collection', spots: [] };
      c.spots.push(s); m.set(key, c);
    }
    return [...m.values()];
  }, [spots]);

  const cur = cols.find((c) => c.key === sel) ?? cols[0];
  const idx = cur ? cols.indexOf(cur) : 0;
  const pins: MapPin[] = useMemo(() => (cur?.spots ?? []).filter((s) => s.lat !== null && s.lng !== null).map((s) => ({
    id: s.id, lat: s.lat!, lng: s.lng!, title: s.place_name || s.address || 'Spot', subtitle: s.address,
    cover: s.cover_url, href: s.video_url, color: PALETTE[idx % PALETTE.length],
  })), [cur, idx]);

  if (!cur) return null;
  const mapped = cur.spots.filter((s) => s.lat !== null);

  return (
    <section className="mt-8" aria-labelledby="pubcols-heading">
      <h2 id="pubcols-heading" className="font-display text-xl font-semibold mb-3">@{creator.tiktok_username}&apos;s collections</h2>
      <div className="flex gap-2 overflow-x-auto pb-1 mb-3" role="group" aria-label="Collections">
        {cols.map((c, i) => (
          <button key={c.key} type="button" onClick={() => setSel(c.key)} aria-pressed={c.key === cur.key}
            className={`shrink-0 px-3.5 py-1.5 text-sm font-extrabold rounded-full inline-flex items-center gap-1.5 ${c.key === cur.key ? 'bg-ink text-white' : 'bg-white text-ink border border-gray-200'}`}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />{c.name}
            <span className="text-xs opacity-70">{c.spots.length}</span>
          </button>
        ))}
      </div>
      {pins.length > 0 && (
        <div className="h-72 rounded-xl overflow-hidden border-2 border-white shadow-[0_6px_20px_rgba(19,41,58,.07)] relative z-0">
          <Map pins={pins} />
        </div>
      )}
      <p className="text-xs font-bold text-gray-500 mt-2">{mapped.length} of {cur.spots.length} spot{cur.spots.length === 1 ? '' : 's'} on the map</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {cur.spots.map((s) => (
          <li key={s.id} className="card p-3 flex gap-3">
            {s.cover_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={s.cover_url} referrerPolicy="no-referrer" alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} className="w-16 h-24 object-cover rounded-md bg-gray-100 shrink-0" />
              : <div className="w-16 h-24 rounded-md bg-gray-100 shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="font-display font-semibold truncate">{s.place_name || s.address || 'Spot'}</p>
              {s.address && <p className="text-xs text-gray-500 truncate">📍 {s.address}</p>}
              <div className="flex gap-4 mt-2 text-xs font-extrabold">
                {s.address && <a href={`https://www.google.com/maps/search/${encodeURIComponent(s.address)}`} target="_blank" rel="noopener" className="text-glacier">Directions ›</a>}
                {s.video_url && <a href={s.video_url} target="_blank" rel="noopener" className="text-glacier">▶ TikTok</a>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
