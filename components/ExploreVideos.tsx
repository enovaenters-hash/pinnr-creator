'use client';

import { useState } from 'react';
import Link from 'next/link';
import PosterTile from '@/components/PosterTile';
import type { PublicVideo } from '@/components/PublicMap';
import { CONTENT_TYPES, creatorTypes } from '@/lib/types';

export type HomeVideo = PublicVideo;

/** Category pills above a 3 x 4 grid of videos. Picking a category shows that category's newest 12. */
export default function ExploreVideos({ videos }: { videos: HomeVideo[] | null }) {
  const [cat, setCat] = useState<string>('all');
  const shown = (videos ?? [])
    .filter((v) => cat === 'all' || creatorTypes(v.creators).includes(cat))
    .slice(0, 12);

  const pills = [{ key: 'all', label: 'All' }, ...CONTENT_TYPES];

  return (
    <section className="mt-10" aria-labelledby="explore-videos">
      <div className="flex items-baseline justify-between mb-3">
        <h2 id="explore-videos" className="text-2xl font-semibold">Explore videos</h2>
        <Link href="/map" className="text-sm font-bold text-glacier hover:underline">See all →</Link>
      </div>

      <div role="group" aria-label="Category" className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-4 px-4 sm:mx-0 sm:px-0">
        {pills.map((p) => (
          <button key={p.key} type="button" onClick={() => setCat(p.key)} aria-pressed={cat === p.key}
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[13px] sm:text-sm font-extrabold transition-colors ${
              cat === p.key ? 'bg-ink text-white' : 'bg-white text-ink ring-2 ring-inset ring-gray-200 hover:ring-ice'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {videos === null && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {Array.from({ length: 12 }, (_, i) => <div key={i} className="rounded-2xl bg-white animate-pulse aspect-[4/5] sm:aspect-[4/3]" />)}
        </div>
      )}
      {videos !== null && shown.length === 0 && (
        <p className="text-sm text-gray-500">No {cat === 'all' ? '' : `${cat} `}videos yet.</p>
      )}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {shown.map((v) => <PosterTile key={v.id} video={v} type={cat === 'all' ? creatorTypes(v.creators)[0] : cat} />)}
      </div>

      <div className="mt-5 flex justify-center">
        <Link href="/map" className="btn-ghost px-7 py-3 text-sm">See all on the map</Link>
      </div>
    </section>
  );
}
