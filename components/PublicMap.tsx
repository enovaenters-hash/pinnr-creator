'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { categoryColor, type Video } from '@/lib/types';
import type { MapPin } from '@/components/Map';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

export type PublicVideo = Video & {
  creators?: { tiktok_username: string; display_name?: string | null; avatar_url?: string | null } | null;
};

/**
 * Map + filters + list of spots. Used by the fan view (/map) and a creator's page (/c/<handle>).
 * With creatorFilter, fans can switch between all creators and one creator.
 */
export default function PublicMap({
  videos, creatorFilter = false, initialCreator = null, onCreatorChange, focusId = null,
}: {
  videos: PublicVideo[];
  creatorFilter?: boolean;
  initialCreator?: string | null;
  onCreatorChange?: (handle: string | null) => void;
  focusId?: string | null;
}) {
  const [creator, setCreator] = useState<string | null>(initialCreator);
  const [cat, setCatState] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(focusId);
  const setCat = (c: string | null) => { setCatState(c); setFocus(null); };

  // Creators that have spots, most spots first.
  const creators = useMemo(() => {
    const byHandle: Record<string, { handle: string; name: string; count: number }> = {};
    videos.forEach((v) => {
      const h = v.creators?.tiktok_username;
      if (!h) return;
      byHandle[h] ??= { handle: h, name: v.creators?.display_name || h, count: 0 };
      byHandle[h].count++;
    });
    return Object.values(byHandle).sort((a, b) => b.count - a.count);
  }, [videos]);

  const byCreator = creator ? videos.filter((v) => v.creators?.tiktok_username === creator) : videos;

  const cats = useMemo(() => {
    const counts: Record<string, number> = {};
    byCreator.forEach((v) => { if (v.category) counts[v.category] = (counts[v.category] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [byCreator]);

  const activeCat = cat && cats.some(([c]) => c === cat) ? cat : null;
  const shown = activeCat ? byCreator.filter((v) => v.category === activeCat) : byCreator;
  const showHandle = creatorFilter && !creator;

  const pins: MapPin[] = useMemo(() => shown.map((v) => ({
    id: v.id, lat: v.lat!, lng: v.lng!,
    title: v.place_name || 'Spot',
    subtitle: [showHandle && v.creators ? `@${v.creators.tiktok_username}` : null, v.address].filter(Boolean).join(' · '),
    cover: v.cover_url, href: v.video_url, color: categoryColor(v.category),
  })), [shown, showHandle]);

  function pickCreator(h: string | null) {
    setCreator(h);
    setFocus(null);
    onCreatorChange?.(h);
  }

  return (
    <>
      {creatorFilter && creators.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          <Chip active={!creator} onClick={() => pickCreator(null)} label={`All creators · ${creators.length}`} />
          {creators.map((c) => (
            <Chip key={c.handle} active={creator === c.handle} onClick={() => pickCreator(c.handle)} label={`@${c.handle} · ${c.count}`} />
          ))}
        </div>
      )}
      {cats.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-2 -mx-4 px-4">
          <Chip active={!activeCat} onClick={() => setCat(null)} label={`All spots ${byCreator.length}`} subtle />
          {cats.map(([c, n]) => (
            <Chip key={c} active={activeCat === c} onClick={() => setCat(c)} label={`${c} ${n}`} color={categoryColor(c)} subtle />
          ))}
        </div>
      )}
      <div className="h-[55vh] min-h-72 rounded-lg overflow-hidden border border-gray-200 relative z-0">
        <Map pins={pins} focusId={focus} />
      </div>
      {shown.length === 0 && <p className="text-sm text-gray-500 mt-4">No spots yet.</p>}
      <ul className="mt-4 divide-y divide-gray-100">
        {shown.map((v) => (
          <li key={v.id}>
            <a href={v.video_url ?? '#'} target="_blank" rel="noopener" className="flex gap-3 py-3 hover:bg-gray-50 rounded-md px-1">
              {v.cover_url
                ? <img src={v.cover_url} referrerPolicy="no-referrer" alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} className="w-12 h-16 object-cover rounded bg-gray-100 shrink-0" />
                : <div className="w-12 h-16 rounded bg-gray-100 shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{v.featured && <span className="text-amber-400">★ </span>}{v.place_name || 'Spot'}</p>
                <p className="text-xs text-gray-500 truncate">{v.address}</p>
                <div className="flex gap-2 mt-1 text-xs">
                  {v.category && <span style={{ color: categoryColor(v.category) }}>#{v.category}</span>}
                  {showHandle && v.creators && <span className="text-gray-400">@{v.creators.tiktok_username}</span>}
                  {v.discount_code && <span className="text-green-700">Code: {v.discount_code}</span>}
                </div>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

function Chip({ label, active, onClick, color, subtle }: {
  label: string; active: boolean; onClick: () => void; color?: string; subtle?: boolean;
}) {
  const on = subtle ? 'bg-gray-100 text-gray-900 border-gray-300 font-medium' : 'bg-gray-900 text-white border-gray-900';
  return (
    <button onClick={onClick}
      className={`shrink-0 px-3 py-1 rounded-full text-xs border whitespace-nowrap ${active ? on : 'bg-white text-gray-700 border-gray-200'}`}>
      {color && <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: color }} />}
      {label}
    </button>
  );
}
