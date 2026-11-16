import Link from 'next/link';
import type { PublicVideo } from '@/components/PublicMap';

export const TYPE_DOT: Record<string, string> = {
  food: '#f97316', fashion: '#d946ef', travel: '#0ea5e9', events: '#7c3aed', other: '#64748b',
};

/** A video as a poster: cover picture, a badge at the top left, and the place name over the bottom. Opens it on the map. */
export default function PosterTile({ video, rank, type }: { video: PublicVideo; rank?: number; type?: string }) {
  const handle = video.creators?.tiktok_username;
  return (
    <Link href={`/map?focus=${video.id}`}
      className="group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-ice to-frost aspect-[4/5] sm:aspect-[4/3] border-2 border-transparent hover:border-ice transition-colors">
      {video.cover_url && (
        <img src={video.cover_url} referrerPolicy="no-referrer" alt="" loading="lazy"
          onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
      )}
      {rank ? (
        <span className="absolute left-1.5 top-1.5 sm:left-2.5 sm:top-2.5 rounded-full bg-sun px-2 py-0.5 text-[10px] sm:text-xs font-extrabold text-ink">★ #{rank}</span>
      ) : type ? (
        <span className="absolute left-1.5 top-1.5 sm:left-2.5 sm:top-2.5 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[9.5px] sm:text-xs font-extrabold capitalize text-ink">
          <i className="h-1.5 w-1.5 rounded-full" style={{ background: TYPE_DOT[type] ?? TYPE_DOT.other }} />{type}
        </span>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6 text-white sm:px-3.5 sm:pb-3 sm:pt-9">
        <p className="font-display text-[13px] sm:text-lg font-semibold leading-tight line-clamp-2">{video.place_name || 'Spot'}</p>
        <p className="mt-0.5 truncate text-[10px] sm:text-xs font-bold opacity-90">
          {[handle ? `@${handle}` : null, video.address].filter(Boolean).join(' · ')}
        </p>
      </div>
    </Link>
  );
}
