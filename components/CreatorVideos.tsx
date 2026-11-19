'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { creatorTypes, type Creator } from '@/lib/types';
import PosterTile from '@/components/PosterTile';
import type { PublicVideo } from '@/components/PublicMap';

type Group = { id: string; name: string; ids: string[] };
const LIMIT = 12;

/**
 * Under the creator's map and list: up to 12 videos from the group chosen in the group blocks (under the map, above
 * the search) in a 3-wide grid that scrolls, same look as Explore videos. Tapping a video opens it in that map.
 */
export default function CreatorVideos({ creator }: { creator: Creator }) {
  const [videos, setVideos] = useState<PublicVideo[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [sel, setSel] = useState<string>('all');

  useEffect(() => {
    const sb = getSupabase();
    let live = true;
    (async () => {
      const [v, g] = await Promise.all([
        sb.from('videos').select('*').eq('creator_id', creator.id).eq('hidden', false)
          .order('posted_at', { ascending: false, nullsFirst: false }).limit(300),
        sb.from('creator_groups').select('id, name, creator_group_items(video_id)')
          .eq('creator_id', creator.id).eq('is_public', true).order('position').order('created_at'),
      ]);
      if (!live) return;
      const withCreator = ((v.data ?? []) as unknown as PublicVideo[]).map((x) => ({
        ...x, creators: { tiktok_username: creator.tiktok_username, display_name: creator.display_name, avatar_url: creator.avatar_url },
      }));
      setVideos(withCreator);
      const have = new Set(withCreator.map((x) => x.id));
      setGroups(((g.data ?? []) as unknown as { id: string; name: string; creator_group_items: { video_id: string }[] }[])
        .map((r) => ({ id: r.id, name: r.name, ids: (r.creator_group_items ?? []).map((i) => i.video_id).filter((id) => have.has(id)) }))
        .filter((r) => r.ids.length > 0));
    })();
    return () => { live = false; };
  }, [creator.id, creator.tiktok_username, creator.display_name, creator.avatar_url]);

  const group = groups.find((g) => g.id === sel) ?? null;
  const inGroup = useMemo(() => (videos ?? []).filter((v) => !group || group.ids.includes(v.id)), [videos, group]);
  const shown = inGroup.slice(0, LIMIT);

  // The group blocks live under the map (FanMap) and announce the choice; the grid follows it.
  useEffect(() => {
    const on = (e: Event) => setSel(((e as CustomEvent<{ id: string | null }>).detail?.id) ?? 'all');
    window.addEventListener('povgo:group', on);
    return () => window.removeEventListener('povgo:group', on);
  }, []);

  // Tapping a video opens it in the creator's map above instead of leaving the page.
  function onGridClick(e: React.MouseEvent) {
    const a = (e.target as HTMLElement).closest('a[href^="/?focus="]') as HTMLAnchorElement | null;
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const id = new URL(a.href).searchParams.get('focus');
    const v = (videos ?? []).find((x) => x.id === id);
    if (!id || !v || v.lat === null) return; // no pin: let the link go to the Explore map / TikTok as before
    e.preventDefault(); e.stopPropagation(); // capture phase: runs before the tile's own Link
    document.getElementById('creator-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.dispatchEvent(new CustomEvent('povgo:focus', { detail: { id, play: true } }));
  }

  if (videos !== null && videos.length === 0) return null;
  const name = creator.display_name || creator.tiktok_username;
  return (
    <section className="mt-10" aria-labelledby="creator-videos">
      <h2 id="creator-videos" className="text-xl sm:text-2xl font-semibold mb-3">{name}&apos;s videos</h2>

      {videos === null ? (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="rounded-2xl bg-white animate-pulse aspect-[4/5] sm:aspect-[4/3]" />)}
        </div>
      ) : (
        <>
          <div role="region" aria-label={group ? `${group.name} videos` : 'Videos'} tabIndex={0} onClickCapture={onGridClick}
            className="max-h-[420px] sm:max-h-[560px] overflow-y-auto rounded-2xl pr-1 focus-visible:outline-2 focus-visible:outline-ice">
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {shown.map((v) => <PosterTile key={v.id} video={v} type={creatorTypes(creator)[0]} />)}
            </div>
          </div>
          <p className="mt-2 text-xs font-bold text-gray-500">
            Showing {shown.length}{inGroup.length > shown.length ? ` of ${inGroup.length}` : ''}{group ? ` in ${group.name}` : ''}, newest first.
          </p>
        </>
      )}
    </section>
  );
}
