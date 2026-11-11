'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { categoryColor, type Video } from '@/lib/types';
import type { MapPin } from '@/components/Map';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

export type PublicVideo = Video & { creators?: { tiktok_username: string } | null };

/** Map + category chips + list of spots. Used by the creator page and the combined map. */
export default function PublicMap({ videos, showCreator = false }: { videos: PublicVideo[]; showCreator?: boolean }) {
  const [cat, setCat] = useState<string | null>(null);

  const cats = useMemo(() => {
    const counts: Record<string, number> = {};
    videos.forEach((v) => { if (v.category) counts[v.category] = (counts[v.category] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [videos]);

  const shown = cat ? videos.filter((v) => v.category === cat) : videos;

  const pins: MapPin[] = useMemo(() => shown.map((v) => ({
    id: v.id, lat: v.lat!, lng: v.lng!,
    title: v.place_name || 'Spot',
    subtitle: [showCreator && v.creators ? `@${v.creators.tiktok_username}` : null, v.address].filter(Boolean).join(' · '),
    cover: v.cover_url, href: v.video_url, color: categoryColor(v.category),
  })), [shown, showCreator]);

  return (
    <>
      {cats.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-2 -mx-4 px-4">
          <Chip active={!cat} onClick={() => setCat(null)} label={`All ${videos.length}`} />
          {cats.map(([c, n]) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)} label={`${c} ${n}`} color={categoryColor(c)} />
          ))}
        </div>
      )}
      <div className="h-[55vh] min-h-72 rounded-lg overflow-hidden border border-gray-200 relative z-0">
        <Map pins={pins} />
      </div>
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
                  {showCreator && v.creators && <span className="text-gray-400">@{v.creators.tiktok_username}</span>}
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

function Chip({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick}
      className={`shrink-0 px-3 py-1 rounded-full text-xs border whitespace-nowrap ${active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}>
      {color && <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: color }} />}
      {label}
    </button>
  );
}
