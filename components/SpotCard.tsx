import Link from 'next/link';
import type { PublicVideo } from '@/components/PublicMap';

/** A spot (video + place) card. Tapping opens the fan map zoomed to it. */
export default function SpotCard({ video, badge }: { video: PublicVideo; badge?: string }) {
  const handle = video.creators?.tiktok_username;
  return (
    <Link href={`/map?focus=${video.id}`}
      className="group block card overflow-hidden border-2 border-transparent hover:border-ice transition-colors">
      <div className="relative aspect-[4/5] bg-frost">
        {video.cover_url && (
          <img src={video.cover_url} referrerPolicy="no-referrer" alt=""
            onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
            className="absolute inset-0 w-full h-full object-cover" />
        )}
        {badge && (
          <span className="absolute top-2 left-2 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-sun text-ink">{badge}</span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/75 to-transparent text-white">
          <p className="font-display text-base font-semibold leading-tight line-clamp-2">{video.place_name || 'Spot'}</p>
          {handle && <p className="text-xs opacity-80 mt-0.5">@{handle}</p>}
        </div>
      </div>
      <div className="px-3 py-2 flex items-center gap-2 text-xs min-w-0">
        {video.category && <span className="shrink-0 font-bold px-2 py-0.5 rounded-full bg-frost text-glacier">{video.category}</span>}
        <span className="text-gray-500 truncate">{video.address}</span>
      </div>
    </Link>
  );
}
