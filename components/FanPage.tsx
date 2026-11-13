'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { getSupabase, supabaseConfigured } from '@/lib/supabase';
import { categoryColor, CONTENT_TYPES } from '@/lib/types';
import {
  FAN_VIDEO_FIELDS, catLabel, cityOf, formatMiles, milesBetween, timeAgo, videoHref,
  type FanCreator, type FanList, type FanVideo, type SavedVideo,
} from '@/lib/fan';
import SiteNav from '@/components/SiteNav';
import CreatorDashboard from '@/components/CreatorDashboard';
import { NotConfigured } from '@/components/AuthCard';
import type { MapPin } from '@/components/Map';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

type View = 'feed' | 'videos' | 'lists' | 'map' | 'creator';
type Sort = 'new' | 'near' | 'creator' | 'az';

const VIEWS: { key: View; label: string; icon: React.ReactNode }[] = [
  { key: 'feed', label: 'Feed', icon: <><rect x="4" y="4" width="16" height="6" rx="2" /><rect x="4" y="13" width="16" height="7" rx="2" /></> },
  { key: 'videos', label: 'My Videos', icon: <><rect x="3.5" y="4.5" width="17" height="15" rx="4" /><path d="M10 8.8L15.5 12L10 15.2Z" fill="#fff" /></> },
  { key: 'lists', label: 'My Lists', icon: <><rect x="4" y="5" width="4" height="4" rx="1.2" /><rect x="4" y="13" width="4" height="4" rx="1.2" /><path d="M11 7H20M11 15H20" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" /></> },
  { key: 'map', label: 'My Map', icon: <><path d="M12 21.5C12 21.5 4.5 14.5 4.5 9.5A7.5 7.5 0 0 1 19.5 9.5C19.5 14.5 12 21.5 12 21.5Z" /><circle cx="12" cy="9.5" r="2.6" fill="#fff" /></> },
  { key: 'creator', label: 'Creator', icon: <><circle cx="12" cy="8" r="4" /><path d="M4 20.5C4 16 7.6 13.5 12 13.5C16.4 13.5 20 16 20 20.5Z" /></> },
];
const SORTS: { key: Sort; label: string }[] = [
  { key: 'new', label: 'Newest saved' }, { key: 'near', label: 'Closest' },
  { key: 'creator', label: 'Creator' }, { key: 'az', label: 'A to Z' },
];
const isView = (v: string | null): v is View => VIEWS.some((x) => x.key === v);

/**
 * The signed-in fan's page: Feed (creators you follow), My Videos (saved, sortable), My Lists,
 * My Map (saved locations) and Creator (your own videos, via the creator dashboard).
 */
export default function FanPage() {
  const [uid, setUid] = useState<string | null | undefined>(undefined); // undefined = checking
  const [name, setName] = useState('');
  const [view, setView] = useState<View>('feed');
  const [follows, setFollows] = useState<FanCreator[]>([]);
  const [creators, setCreators] = useState<FanCreator[]>([]);
  const [feed, setFeed] = useState<FanVideo[] | null>(null);
  const [saved, setSaved] = useState<SavedVideo[]>([]);
  const [lists, setLists] = useState<FanList[]>([]);
  const [sort, setSort] = useState<Sort>('new');
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [openList, setOpenList] = useState<string | null>(null);
  const [mapFilter, setMapFilter] = useState<string>('all');
  const [finding, setFinding] = useState(false);
  const [notice, setNotice] = useState('');
  const [discover, setDiscover] = useState<FanVideo[] | null>(null);
  const [dtype, setDtype] = useState<string>('all');

  const go = useCallback((v: View) => {
    setView(v);
    const url = new URL(window.location.href);
    if (v === 'feed') url.searchParams.delete('view'); else url.searchParams.set('view', v);
    window.history.replaceState(null, '', url);
    window.scrollTo({ top: 0 });
  }, []);

  const loadFeed = useCallback(async (ids: string[]) => {
    if (!ids.length) { setFeed([]); return; }
    const { data } = await getSupabase().from('videos').select(FAN_VIDEO_FIELDS)
      .in('creator_id', ids).eq('hidden', false)
      .order('posted_at', { ascending: false, nullsFirst: false }).limit(30);
    setFeed((data as unknown as FanVideo[]) ?? []);
  }, []);

  /** Newest videos from creators this person doesn't follow yet (their own are left out). */
  const loadDiscover = useCallback(async (ids: string[], me: string) => {
    let q = getSupabase().from('videos').select(FAN_VIDEO_FIELDS)
      .eq('hidden', false).neq('creator_id', me)
      .order('posted_at', { ascending: false, nullsFirst: false }).limit(80);
    if (ids.length) q = q.not('creator_id', 'in', `(${ids.join(',')})`);
    const { data } = await q;
    setDiscover((data as unknown as FanVideo[]) ?? []);
  }, []);

  const locate = useCallback((onFail?: () => void) => {
    if (!navigator.geolocation) { onFail?.(); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => onFail?.(),
      { maximumAge: 300000, timeout: 10000 },
    );
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const wanted = new URLSearchParams(window.location.search).get('view');
    if (isView(wanted)) setView(wanted);
    const supabase = getSupabase();
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setUid(null); return; }
      const id = session.user.id;
      const [f, s, l, c, me] = await Promise.all([
        supabase.from('follows').select('creator_id, creators(id, tiktok_username, display_name, avatar_url)').eq('user_id', id),
        supabase.from('saved_videos').select(`created_at, videos(${FAN_VIDEO_FIELDS})`).eq('user_id', id).order('created_at', { ascending: false }),
        supabase.from('lists').select('id, name, list_items(video_id)').eq('user_id', id).order('created_at'),
        supabase.from('creators').select('id, tiktok_username, display_name, avatar_url').order('created_at', { ascending: false }).limit(60),
        supabase.from('creators').select('display_name, tiktok_username').eq('id', id).maybeSingle(),
      ]);
      const followed = ((f.data ?? []) as unknown as { creators: FanCreator | null }[])
        .map((r) => r.creators).filter((x): x is FanCreator => Boolean(x));
      setFollows(followed);
      setSaved(((s.data ?? []) as unknown as { created_at: string; videos: FanVideo | null }[])
        .filter((r) => r.videos).map((r) => ({ savedAt: r.created_at, video: r.videos! })));
      setLists(((l.data ?? []) as unknown as { id: string; name: string; list_items: { video_id: string }[] }[])
        .map((r) => ({ id: r.id, name: r.name, videoIds: (r.list_items ?? []).map((i) => i.video_id) })));
      setCreators(((c.data as FanCreator[]) ?? []).filter((x) => x.id !== id)); // don't offer to follow yourself
      const meta = session.user.user_metadata as { display_name?: string } | undefined;
      setName(me.data?.display_name || meta?.display_name || session.user.email?.split('@')[0] || 'there');
      setUid(id);
      setFinding(followed.length === 0);
      loadFeed(followed.map((x) => x.id));
      loadDiscover(followed.map((x) => x.id), id);
      try { setDtype(localStorage.getItem('povgo-discover-type') || 'all'); } catch { /* private window */ }
      // If location was already allowed, use it straight away so "local" works without a tap.
      try {
        const perm = await navigator.permissions?.query({ name: 'geolocation' });
        if (perm?.state === 'granted') locate();
      } catch { /* not supported; the "Use my location" button still works */ }
    })();
  }, [loadFeed, loadDiscover, locate]);

  const savedIds = useMemo(() => new Set(saved.map((s) => s.video.id)), [saved]);
  const followIds = useMemo(() => new Set(follows.map((f) => f.id)), [follows]);
  const flash = (text: string) => { setNotice(text); window.setTimeout(() => setNotice(''), 2500); };

  async function toggleSave(v: FanVideo) {
    if (!uid) return;
    const supabase = getSupabase();
    if (savedIds.has(v.id)) {
      setSaved((xs) => xs.filter((x) => x.video.id !== v.id));
      setLists((ls) => ls.map((l) => ({ ...l, videoIds: l.videoIds.filter((id) => id !== v.id) })));
      const mine = lists.map((l) => l.id);
      if (mine.length) await supabase.from('list_items').delete().eq('video_id', v.id).in('list_id', mine);
      const { error } = await supabase.from('saved_videos').delete().eq('user_id', uid).eq('video_id', v.id);
      if (error) flash('Couldn’t remove that. Try again.');
    } else {
      setSaved((xs) => [{ savedAt: new Date().toISOString(), video: v }, ...xs]);
      const { error } = await supabase.from('saved_videos').insert({ user_id: uid, video_id: v.id });
      if (error) { setSaved((xs) => xs.filter((x) => x.video.id !== v.id)); flash('Couldn’t save that. Try again.'); }
      else flash('Saved to My Videos');
    }
  }

  async function toggleFollow(c: FanCreator) {
    if (!uid) return;
    const supabase = getSupabase();
    const next = followIds.has(c.id) ? follows.filter((f) => f.id !== c.id) : [...follows, c];
    setFollows(next);
    const { error } = followIds.has(c.id)
      ? await supabase.from('follows').delete().eq('user_id', uid).eq('creator_id', c.id)
      : await supabase.from('follows').insert({ user_id: uid, creator_id: c.id });
    if (error) { setFollows(follows); flash('Couldn’t update that. Try again.'); return; }
    loadFeed(next.map((x) => x.id));
    loadDiscover(next.map((x) => x.id), uid);
  }

  async function createList(listName: string): Promise<string | null> {
    if (!uid) return null;
    const clean = listName.trim().slice(0, 60);
    if (!clean) return null;
    const { data, error } = await getSupabase().from('lists').insert({ user_id: uid, name: clean }).select('id, name').single();
    if (error || !data) { flash('Couldn’t create that list. Try again.'); return null; }
    setLists((ls) => [...ls, { id: data.id, name: data.name, videoIds: [] }]);
    setOpenList(data.id);
    return data.id;
  }

  async function deleteList(id: string) {
    setLists((ls) => ls.filter((l) => l.id !== id));
    if (openList === id) setOpenList(null);
    if (mapFilter === id) setMapFilter('all');
    const { error } = await getSupabase().from('lists').delete().eq('id', id);
    if (error) flash('Couldn’t delete that list. Refresh and try again.');
  }

  async function toggleListItem(listId: string, videoId: string) {
    // A list created a moment ago isn't in `lists` yet in this render, so treat "not found" as "not in it".
    const has = lists.find((l) => l.id === listId)?.videoIds.includes(videoId) ?? false;
    setLists((ls) => ls.map((l) => l.id !== listId ? l
      : { ...l, videoIds: has ? l.videoIds.filter((x) => x !== videoId) : [...new Set([...l.videoIds, videoId])] }));
    const supabase = getSupabase();
    const { error } = has
      ? await supabase.from('list_items').delete().eq('list_id', listId).eq('video_id', videoId)
      : await supabase.from('list_items').insert({ list_id: listId, video_id: videoId });
    if (error) flash('Couldn’t update that list. Refresh and try again.');
  }

  function pickSort(s: Sort) {
    setSort(s);
    if (s !== 'near' || here) return;
    locate(() => flash('Turn on location to sort by closest.'));
  }

  function pickType(t: string) {
    setDtype(t);
    try { localStorage.setItem('povgo-discover-type', t); } catch { /* private window */ }
  }

  if (!supabaseConfigured) return <main className="max-w-xl mx-auto p-6"><NotConfigured /></main>;

  if (uid === undefined) {
    return <><SiteNav active="login" /><main className="flex-1 flex items-center justify-center text-sm text-gray-500">Loading…</main></>;
  }

  if (uid === null) {
    return (
      <>
        <SiteNav active="login" />
        <main className="flex-1 flex items-center justify-center px-4 py-12 bg-cloud">
          <div className="card p-7 w-full max-w-sm text-center">
            <h1 className="text-2xl font-semibold text-ink">Your POVGo fan page</h1>
            <p className="text-sm text-gray-600 mt-2">Follow creators, save the videos you want to try, group them into lists and see them all on your own map.</p>
            <div className="mt-6 grid gap-2">
              <Link href="/signup?as=fan" className="btn-sun py-3 text-sm">Create a fan account</Link>
              <Link href="/login?next=/fan" className="btn-ghost py-3 text-sm">Sign in</Link>
              <Link href="/map" className="text-sm font-bold text-glacier hover:underline mt-1">Just explore the map →</Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  // Discover: unfollowed creators, filtered by the chosen type, and by distance once location is on.
  const LOCAL_MILES = 50;
  const typed = (discover ?? []).filter((v) => dtype === 'all' || (v.creators?.content_type ?? 'food') === dtype);
  const nearby = here ? typed.filter((v) => v.lat !== null && v.lng !== null && milesBetween(here, { lat: v.lat, lng: v.lng }) <= LOCAL_MILES) : [];
  const local = nearby.length ? nearby : typed;
  const localNote = !here ? 'everywhere for now' : nearby.length ? `within ${LOCAL_MILES} miles of you` : 'nothing new near you yet, so here’s everywhere';

  const dist = (v: FanVideo) => (here && v.lat !== null && v.lng !== null ? milesBetween(here, { lat: v.lat, lng: v.lng }) : null);
  const handleOf = (v: FanVideo) => v.creators?.tiktok_username ?? '';
  const sorted = [...saved].sort((a, b) => {
    if (sort === 'near') return (dist(a.video) ?? 1e9) - (dist(b.video) ?? 1e9);
    if (sort === 'creator') return handleOf(a.video).localeCompare(handleOf(b.video)) || (a.video.place_name ?? '').localeCompare(b.video.place_name ?? '');
    if (sort === 'az') return (a.video.place_name ?? '~').localeCompare(b.video.place_name ?? '~');
    return b.savedAt.localeCompare(a.savedAt);
  });
  const sortTag = (s: SavedVideo) => {
    if (sort === 'near') { const d = dist(s.video); return d === null ? '' : formatMiles(d); }
    if (sort === 'creator') return handleOf(s.video) ? `@${handleOf(s.video)}` : '';
    if (sort === 'az') return '';
    return `Saved ${timeAgo(s.savedAt).toLowerCase()}`;
  };
  const current = lists.find((l) => l.id === openList) ?? lists[0] ?? null;
  const inList = (l: FanList) => saved.filter((s) => l.videoIds.includes(s.video.id));
  const mapList = lists.find((l) => l.id === mapFilter);
  const onMap = (mapList ? inList(mapList) : saved).filter((s) => s.video.lat !== null && s.video.lng !== null);
  const pins: MapPin[] = onMap.map(({ video: v }) => ({
    id: v.id, lat: v.lat!, lng: v.lng!, title: v.place_name || 'Saved spot', subtitle: v.address,
    cover: v.cover_url, href: v.video_url, color: categoryColor(v.category),
  }));

  return (
    <>
      <SiteNav active="login" />
      <main className="flex-1 bg-cloud text-ink">
        <div className="max-w-5xl mx-auto px-4 pt-5 pb-28 sm:pb-16">
          {/* Who + navigation (buttons across the top on a computer) */}
          <header className="flex flex-wrap items-center gap-x-4 gap-y-3 mb-5">
            <div className="min-w-0">
              <h1 className="font-display text-2xl sm:text-3xl font-semibold leading-tight truncate">Hey, {name}</h1>
              <p className="text-xs sm:text-sm font-bold text-gray-500">
                {saved.length} saved · {lists.length} list{lists.length === 1 ? '' : 's'} · {follows.length} creator{follows.length === 1 ? '' : 's'}
              </p>
            </div>
            <nav aria-label="Fan page" className="hidden sm:flex gap-1.5 ml-auto">
              {VIEWS.map((v) => (
                <button key={v.key} type="button" onClick={() => go(v.key)} aria-current={view === v.key ? 'page' : undefined}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-extrabold rounded-full whitespace-nowrap ${view === v.key ? 'btn-sun' : 'btn-ghost'}`}>
                  <NavIcon>{v.icon}</NavIcon>{v.label}
                </button>
              ))}
            </nav>
          </header>

          {view === 'feed' && (
            <section>
              <div className="flex gap-3 overflow-x-auto pb-2 mb-4">
                {follows.map((c) => (
                  <Link key={c.id} href={`/c/${c.tiktok_username}`} className="shrink-0 grid justify-items-center gap-1 w-16 text-[11px] font-extrabold">
                    <Avatar creator={c} className="w-14 h-14 border-[3px] border-sun" />
                    <span className="max-w-full truncate">{c.display_name || c.tiktok_username}</span>
                  </Link>
                ))}
                <button type="button" onClick={() => setFinding((x) => !x)} aria-expanded={finding}
                  className="shrink-0 grid justify-items-center gap-1 w-16 text-[11px] font-extrabold text-gray-500">
                  <span className="w-14 h-14 rounded-full border-2 border-dashed border-gray-400 bg-white grid place-items-center text-xl">{finding ? '×' : '+'}</span>
                  {finding ? 'Close' : 'Find more'}
                </button>
              </div>

              {finding && (
                <div className="card p-3 mb-5">
                  <h2 className="text-lg font-semibold px-1 mb-1">Creators to follow</h2>
                  {creators.length === 0 && <p className="text-sm text-gray-500 p-2">No creators have joined yet.</p>}
                  <ul className="divide-y divide-gray-100">
                    {creators.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 py-2 px-1">
                        <Avatar creator={c} className="w-10 h-10" />
                        <Link href={`/c/${c.tiktok_username}`} className="min-w-0 flex-1">
                          <span className="block text-sm font-extrabold truncate">{c.display_name || c.tiktok_username}</span>
                          <span className="block text-xs text-gray-500 truncate">@{c.tiktok_username}</span>
                        </Link>
                        <button type="button" onClick={() => toggleFollow(c)} aria-pressed={followIds.has(c.id)}
                          className={`px-4 py-1.5 text-xs ${followIds.has(c.id) ? 'btn-ghost' : 'btn-sun'}`}>
                          {followIds.has(c.id) ? 'Following' : 'Follow'}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <h2 className="text-xl font-semibold mb-3 flex flex-wrap items-baseline gap-x-2">New from your creators
                <span className="text-xs font-bold text-gray-500 font-sans">newest first</span></h2>
              {feed === null && <Skeleton />}
              {feed?.length === 0 && (
                <Empty>{follows.length ? 'The creators you follow haven’t posted any videos yet.' : 'Follow a few creators and their newest videos will show up here.'}</Empty>
              )}
              {feed && feed.length > 0 && (
                <Scroller label="New from your creators">
                  {feed.map((v) => <FeedCard key={v.id} video={v} saved={savedIds.has(v.id)} onSave={() => toggleSave(v)} />)}
                </Scroller>
              )}

              <h2 className="text-xl font-semibold mt-7 mb-2 flex flex-wrap items-baseline gap-x-2">New from local creators
                <span className="text-xs font-bold text-gray-500 font-sans">{localNote}</span></h2>
              <div className="flex flex-wrap items-center gap-1.5 mb-3" role="group" aria-label="Choose what to discover">
                <span className="text-xs font-extrabold text-gray-500 mr-1">Discover</span>
                {[{ key: 'all', label: 'All' }, ...CONTENT_TYPES].map((t) => (
                  <button key={t.key} type="button" onClick={() => pickType(t.key)} aria-pressed={dtype === t.key}
                    className={`px-3 py-1.5 text-xs font-extrabold rounded-full ${dtype === t.key ? 'bg-ink text-white' : 'bg-white text-ink border border-gray-200'}`}>
                    {t.label}
                  </button>
                ))}
                {!here && (
                  <button type="button" onClick={() => locate(() => flash('Turn on location to see local creators.'))}
                    className="btn-sun px-3 py-1.5 text-xs sm:ml-auto">Use my location</button>
                )}
              </div>
              {discover === null && <Skeleton />}
              {discover !== null && local.length === 0 && (
                <Empty>{dtype === 'all' ? 'No new creators to discover right now.' : 'No creators of this type yet. Try All.'}</Empty>
              )}
              {local.length > 0 && (
                <Scroller label="New from local creators">
                  {local.map((v) => {
                    const c = creators.find((x) => x.id === v.creator_id);
                    return <FeedCard key={v.id} video={v} saved={savedIds.has(v.id)} onSave={() => toggleSave(v)}
                      onFollow={c ? () => toggleFollow(c) : undefined} />;
                  })}
                </Scroller>
              )}
            </section>
          )}

          {view === 'videos' && (
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-baseline gap-2">My videos
                <span className="text-xs font-bold text-gray-500 font-sans">{saved.length} saved from creators</span></h2>
              {saved.length === 0 ? (
                <Empty>Nothing saved yet. Tap the heart on any video in your <button type="button" className="font-extrabold text-glacier underline" onClick={() => go('feed')}>Feed</button> or on the <Link href="/map" className="font-extrabold text-glacier underline">Map</Link>.</Empty>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-1.5 mb-4" role="group" aria-label="Sort my videos">
                    <span className="text-xs font-extrabold text-gray-500 mr-1">Sort by</span>
                    {SORTS.map((s) => (
                      <button key={s.key} type="button" onClick={() => pickSort(s.key)} aria-pressed={sort === s.key}
                        className={`px-3 py-1.5 text-xs font-extrabold rounded-full ${sort === s.key ? 'bg-ink text-white' : 'bg-white text-ink border border-gray-200'}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 items-start">
                    {sorted.map((s) => (
                      <SavedCard key={s.video.id} item={s} tag={sortTag(s)} lists={lists}
                        onUnsave={() => toggleSave(s.video)} onToggleList={toggleListItem} onNewList={createList} />
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {view === 'lists' && (
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-baseline gap-2">My lists
                <span className="text-xs font-bold text-gray-500 font-sans">tap a list to open it</span></h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
                {lists.map((l) => {
                  const items = inList(l);
                  return (
                    <button key={l.id} type="button" onClick={() => setOpenList(l.id)} aria-pressed={current?.id === l.id}
                      className={`card p-2 text-left grid grid-cols-[minmax(0,1fr)] gap-1.5 content-start min-w-0 ${current?.id === l.id ? 'ring-4 ring-sun' : ''}`}>
                      <span className="grid grid-cols-2 gap-0.5 rounded-xl overflow-hidden bg-frost aspect-square">
                        {[0, 1, 2, 3].map((i) => (
                          <span key={i} className="relative bg-frost">
                            {items[i]?.video.cover_url && <img src={items[i].video.cover_url!} referrerPolicy="no-referrer" alt=""
                              onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} className="absolute inset-0 w-full h-full object-cover" />}
                          </span>
                        ))}
                      </span>
                      <span className="font-display font-semibold truncate px-1">{l.name}</span>
                      <span className="text-xs font-bold text-gray-500 px-1 pb-1">{items.length} spot{items.length === 1 ? '' : 's'}</span>
                    </button>
                  );
                })}
                <NewListCard onCreate={createList} />
              </div>

              {current ? (
                <ListDetail key={current.id} list={current} items={inList(current)}
                  onRemove={(id) => toggleListItem(current.id, id)} onDelete={() => deleteList(current.id)}
                  onMap={() => { setMapFilter(current.id); go('map'); }} />
              ) : (
                <Empty>Make a list like “Date night”, then add videos to it from My Videos.</Empty>
              )}
            </section>
          )}

          {view === 'map' && (
            <section>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
                <h2 className="text-xl font-semibold flex items-baseline gap-2">My map
                  <span className="text-xs font-bold text-gray-500 font-sans">{onMap.length} saved location{onMap.length === 1 ? '' : 's'}</span></h2>
                <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto" role="group" aria-label="Show on map">
                  <span className="text-xs font-extrabold text-gray-500 mr-1">Show</span>
                  {[{ id: 'all', name: 'All saved' }, ...lists].map((l) => (
                    <button key={l.id} type="button" onClick={() => setMapFilter(l.id)} aria-pressed={mapFilter === l.id}
                      className={`px-3 py-1.5 text-xs font-extrabold rounded-full ${mapFilter === l.id ? 'bg-ink text-white' : 'bg-white text-ink border border-gray-200'}`}>
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>
              {onMap.length === 0 ? (
                <Empty>{saved.length ? 'None of these saved videos has a location on the map yet.' : 'Save a few videos and their locations will show up here.'}</Empty>
              ) : (
                <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[18rem_minmax(0,1fr)] items-start">
                  <div className="h-[55vh] sm:h-[32rem] rounded-xl overflow-hidden border-2 border-white shadow-[0_6px_20px_rgba(19,41,58,.07)] relative z-0 sm:order-2">
                    <Map pins={pins} />
                  </div>
                  <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:order-1">
                    {onMap.map(({ video: v }) => (
                      <li key={v.id}><Row video={v} right={<Link href={videoHref(v)} className="btn-sun px-3 py-1.5 text-xs shrink-0">Open</Link>} /></li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {view === 'creator' && <CreatorDashboard embedded />}
        </div>
      </main>

      {/* Navigation along the bottom on a phone */}
      <nav aria-label="Fan page" className="sm:hidden fixed inset-x-0 bottom-0 z-[1090] bg-white border-t border-gray-200 grid grid-cols-5 px-1 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
        {VIEWS.map((v) => (
          <button key={v.key} type="button" onClick={() => go(v.key)} aria-current={view === v.key ? 'page' : undefined}
            className={`grid justify-items-center gap-0.5 py-1.5 rounded-2xl text-[10px] font-extrabold leading-tight ${view === v.key ? 'bg-sun-soft text-ink' : 'text-gray-500'}`}>
            <NavIcon className="w-6 h-6">{v.icon}</NavIcon>{v.label}
          </button>
        ))}
      </nav>

      {notice && (
        <div role="status" className="pointer-events-none fixed left-1/2 -translate-x-1/2 bottom-24 sm:bottom-6 z-[1200] bg-ink text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg">{notice}</div>
      )}
    </>
  );
}

/** A sideways-scrolling row: two cards in view on a phone, four on a computer. */
function Scroller({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="list" aria-label={label} tabIndex={0}
      className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-pl-4 sm:scroll-pl-0 -mx-4 px-4 sm:mx-0 sm:px-0 pb-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-frost rounded-xl">
      {children}
    </div>
  );
}

function FeedCard({ video: v, saved, onSave, onFollow }: { video: FanVideo; saved: boolean; onSave: () => void; onFollow?: () => void }) {
  const handle = v.creators?.tiktok_username;
  return (
    <article role="listitem" className="card p-2 grid grid-cols-[minmax(0,1fr)] gap-2 content-start shrink-0 w-[46%] sm:w-[23.6%] snap-start">
      <Cover video={v} ratio="aspect-[3/4] sm:aspect-[4/5]" sub={[catLabel(v.category), cityOf(v.address)].filter(Boolean).join(' · ')} />
      <div className="flex items-center gap-1.5 px-0.5">
        {v.creators && <Avatar creator={v.creators} className="w-7 h-7 text-xs" />}
        <Link href={handle ? `/c/${handle}` : '/map'} className="min-w-0 flex-1">
          <span className="block text-xs sm:text-sm font-extrabold truncate">{v.creators?.display_name || handle}</span>
          <span className="block text-[11px] font-bold text-gray-500 truncate">{timeAgo(v.posted_at)}</span>
        </Link>
        <Heart on={saved} onClick={onSave} name={v.place_name} />
      </div>
      {onFollow && <button type="button" onClick={onFollow} className="btn-ghost py-1.5 text-xs">+ Follow</button>}
    </article>
  );
}

function NavIcon({ children, className = 'w-4 h-4' }: { children: React.ReactNode; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">{children}</svg>;
}

function Avatar({ creator, className }: { creator: Pick<FanCreator, 'tiktok_username' | 'display_name' | 'avatar_url'>; className: string }) {
  const letter = (creator.display_name || creator.tiktok_username).charAt(0).toUpperCase();
  return (
    <span className={`relative rounded-full bg-frost text-glacier font-display font-semibold grid place-items-center shrink-0 overflow-hidden ${className}`}>
      {letter}
      {creator.avatar_url && <img src={creator.avatar_url} referrerPolicy="no-referrer" alt=""
        onError={(e) => { e.currentTarget.style.display = 'none'; }} className="absolute inset-0 w-full h-full object-cover" />}
    </span>
  );
}

function Cover({ video: v, ratio, sub, tag }: { video: FanVideo; ratio: string; sub?: string; tag?: string }) {
  const tiktok = v.lat === null;
  return (
    <a href={videoHref(v)} {...(tiktok ? { target: '_blank', rel: 'noopener' } : {})}
      className={`group relative block ${ratio} rounded-xl overflow-hidden bg-frost`}>
      {v.cover_url && <img src={v.cover_url} referrerPolicy="no-referrer" alt=""
        onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />}
      {tag && <span className="absolute top-2 left-2 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-sun text-ink">{tag}</span>}
      <span className="absolute inset-x-0 bottom-0 px-2.5 pt-8 pb-2 bg-gradient-to-t from-black/80 to-transparent text-white">
        <span className="block font-display font-semibold text-sm sm:text-base leading-tight truncate">{v.place_name || 'Spot'}</span>
        {sub && <span className="block text-[11px] font-bold opacity-85 truncate">{sub}</span>}
      </span>
    </a>
  );
}

function Heart({ on, onClick, name }: { on: boolean; onClick: () => void; name: string | null }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} aria-label={`${on ? 'Remove' : 'Save'} ${name || 'this video'}`}
      className={`w-9 h-9 rounded-full grid place-items-center text-lg shrink-0 ${on ? 'bg-sun text-ink' : 'bg-cloud text-ink hover:bg-frost'}`}>
      {on ? '♥' : '♡'}
    </button>
  );
}

function Row({ video: v, right }: { video: FanVideo; right?: React.ReactNode }) {
  return (
    <div className="card p-2 flex items-center gap-3">
      <span className="relative w-12 h-12 rounded-xl overflow-hidden bg-frost shrink-0">
        {v.cover_url && <img src={v.cover_url} referrerPolicy="no-referrer" alt=""
          onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} className="absolute inset-0 w-full h-full object-cover" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display font-semibold text-sm truncate">{v.place_name || 'Spot'}</span>
        <span className="block text-xs font-bold text-gray-500 truncate">
          {[catLabel(v.category), cityOf(v.address), v.creators ? `@${v.creators.tiktok_username}` : ''].filter(Boolean).join(' · ')}
        </span>
      </span>
      {right}
    </div>
  );
}

function SavedCard({ item, tag, lists, onUnsave, onToggleList, onNewList }: {
  item: SavedVideo; tag: string; lists: FanList[];
  onUnsave: () => void; onToggleList: (listId: string, videoId: string) => void; onNewList: (name: string) => Promise<string | null>;
}) {
  const v = item.video;
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const count = lists.filter((l) => l.videoIds.includes(v.id)).length;
  return (
    <article className="card p-2 grid grid-cols-[minmax(0,1fr)] gap-2 content-start min-w-0">
      <Cover video={v} ratio="aspect-[3/4] sm:aspect-[5/4]" tag={tag}
        sub={[v.creators ? `@${v.creators.tiktok_username}` : '', cityOf(v.address)].filter(Boolean).join(' · ')} />
      <div className="flex items-center gap-2 px-1 pb-1">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className="btn-ghost px-3 py-1.5 text-xs">{count ? `In ${count} list${count === 1 ? '' : 's'}` : '+ List'}</button>
        <span className="ml-auto"><Heart on onClick={onUnsave} name={v.place_name} /></span>
      </div>
      {open && (
        <div className="px-1 pb-1 grid grid-cols-[minmax(0,1fr)] gap-1.5">
          {lists.map((l) => {
            const inIt = l.videoIds.includes(v.id);
            return (
              <button key={l.id} type="button" onClick={() => onToggleList(l.id, v.id)} aria-pressed={inIt}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold text-left ${inIt ? 'bg-sun text-ink' : 'bg-cloud text-ink'}`}>
                <span aria-hidden="true">{inIt ? '✓' : '+'}</span><span className="truncate">{l.name}</span>
              </button>
            );
          })}
          <form className="flex flex-wrap gap-1.5" onSubmit={async (e) => {
            e.preventDefault();
            const id = await onNewList(newName);
            if (id) { onToggleList(id, v.id); setNewName(''); }
          }}>
            <input id={`new-list-${v.id}`} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New list name" maxLength={60}
              aria-label="New list name"
              className="min-w-0 flex-[1_1_7rem] px-3 py-1.5 text-xs rounded-full border-2 border-gray-200 bg-white focus:outline-none focus:border-ice" />
            <button className="btn-sun px-3 py-1.5 text-xs flex-[1_0_auto]" disabled={!newName.trim()}>Add</button>
          </form>
        </div>
      )}
    </article>
  );
}

function NewListCard({ onCreate }: { onCreate: (name: string) => Promise<string | null> }) {
  const [name, setName] = useState('');
  return (
    <form onSubmit={async (e) => { e.preventDefault(); if (await onCreate(name)) setName(''); }}
      className="rounded-xl border-2 border-dashed border-gray-400 p-3 grid grid-cols-[minmax(0,1fr)] gap-2 content-center min-h-[9rem] min-w-0">
      <label htmlFor="new-list-name" className="text-sm font-extrabold text-gray-600 text-center">+ New list</label>
      <input id="new-list-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Date night" maxLength={60}
        className="min-w-0 w-full px-3 py-2 text-sm rounded-full border-2 border-gray-200 bg-white focus:outline-none focus:border-ice" />
      <button className="btn-sun py-2 text-sm" disabled={!name.trim()}>Create</button>
    </form>
  );
}

function ListDetail({ list, items, onRemove, onDelete, onMap }: {
  list: FanList; items: SavedVideo[]; onRemove: (videoId: string) => void; onDelete: () => void; onMap: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h3 className="text-xl font-semibold mr-auto flex items-baseline gap-2">{list.name}
          <span className="text-xs font-bold text-gray-500 font-sans">{items.length} spot{items.length === 1 ? '' : 's'}</span></h3>
        {confirming ? (
          <>
            <span className="text-xs font-bold text-gray-600">Delete this list?</span>
            <button type="button" onClick={onDelete} className="px-3 py-1.5 text-xs font-extrabold rounded-full bg-red-600 text-white">Delete</button>
            <button type="button" onClick={() => setConfirming(false)} className="btn-ghost px-3 py-1.5 text-xs">Keep</button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setConfirming(true)} className="btn-ghost px-3 py-1.5 text-xs">Delete list</button>
            <button type="button" onClick={onMap} className="btn-sun px-4 py-1.5 text-xs" disabled={items.length === 0}>Map this list</button>
          </>
        )}
      </div>
      {items.length === 0 && <Empty>This list is empty. Open My Videos and tap “+ List” on a video to add it here.</Empty>}
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
        {items.map(({ video: v }) => (
          <li key={v.id}>
            <Row video={v} right={<button type="button" onClick={() => onRemove(v.id)} className="btn-ghost px-3 py-1.5 text-xs shrink-0">Remove</button>} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-600 text-center px-4 py-8">{children}</p>;
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {[0, 1, 2].map((i) => <div key={i} className="aspect-[5/4] sm:aspect-[4/5] rounded-xl bg-white animate-pulse" />)}
    </div>
  );
}
