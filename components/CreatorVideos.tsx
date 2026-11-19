'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { creatorTypes, type Creator } from '@/lib/types';
import PosterTile from '@/components/PosterTile';
import type { PublicVideo } from '@/components/PublicMap';

type Group = { id: string; name: string; ids: string[] };
const LIMIT = 12;

/**
 * Under the creator's map and list: the creator's public groups as photo buttons, then up to 12 videos from the
 * chosen group in a 3-wide grid that scrolls (same look as Explore videos). Picking a group also narrows the map
 * and the place list above (FanMap listens for `povgo:group`). Tapping a video opens it in that map.
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
  const covers = (list: PublicVideo[]) => list.filter((v) => v.cover_url).slice(0, 4).map((v) => v.cover_url as string);

  function pick(id: string) {
    setSel(id);
    window.dispatchEvent(new CustomEvent('povgo:group', { detail: { id: id === 'all' ? null : id } }));
  }

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
  const tiles: { id: string; label: string; list: PublicVideo[] }[] = [
    { id: 'all', label: 'All', list: videos ?? [] },
    ...groups.map((g) => ({ id: g.id, label: g.name, list: (videos ?? []).filter((v) => g.ids.includes(v.id)) })),
  ];

  return (
    <section className="mt-10" aria-labelledby="creator-videos">
      <h2 id="creator-videos" className="text-xl sm:text-2xl font-semibold mb-3">{name}&apos;s videos</h2>

      {groups.length > 0 && (
        <div role="group" aria-label="Groups" className="flex gap-2.5 overflow-x-auto pb-3 mb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          {tiles.map((t) => {
            const pics = covers(t.list);
            const on = sel === t.id;
            return (
              <button key={t.id} type="button" onClick={() => pick(t.id)} aria-pressed={on}
                className={`shrink-0 w-[104px] sm:w-[128px] overflow-hidden rounded-2xl bg-white text-left pb-2 ring-2 ring-inset ${on ? 'ring-ink bg-sun-soft' : 'ring-gray-200 hover:ring-ice'}`}>
                <span className={`grid h-[62px] sm:h-[72px] overflow-hidden bg-frost ${pics.length > 1 ? 'grid-cols-2 grid-rows-2' : ''}`}>
                  {pics.map((src, i) => (
                    <img key={src} src={src} alt="" referrerPolicy="no-referrer" loading="lazy"
                      onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                      className={`h-full w-full object-cover ${pics.length === 2 ? 'row-span-2' : pics.length === 3 && i === 0 ? 'row-span-2' : ''}`} />
                  ))}
                </span>
                <span className="block truncate px-2.5 pt-1.5 font-display text-sm font-semibold leading-tight">{t.label}</span>
                <span className="block px-2.5 text-[11px] font-extrabold text-gray-500">{t.list.length} video{t.list.length === 1 ? '' : 's'}</span>
              </button>
            );
          })}
        </div>
      )}

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
