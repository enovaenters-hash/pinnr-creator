'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { getSupabase, supabaseConfigured } from '@/lib/supabase';
import { CONTENT_TYPES, creatorTypes } from '@/lib/types';
import {
  FAN_VIDEO_FIELDS, catLabel, cityOf, formatMiles, milesBetween, timeAgo, videoHref,
  type FanCreator, type FanList, type FanVideo, type SavedVideo,
} from '@/lib/fan';
import BottomNav from '@/components/BottomNav';
import SiteNav from '@/components/SiteNav';
import CreatorDashboard from '@/components/CreatorDashboard';
import { NotConfigured } from '@/components/AuthCard';

const FanMap = dynamic(() => import('@/components/FanMap'), { ssr: false });

/** Three main parts: Explore (the public home page, unchanged), Following and My Spots. */
type View = 'following' | 'myspots';
/** Inside Following: newest from your creators, and your saved videos. The map sits under both. */
type FTab = 'latest' | 'saved';
type Sort = 'new' | 'near' | 'creator' | 'az';

const FTABS: { key: FTab; label: string }[] = [
  { key: 'latest', label: 'Latest' }, { key: 'saved', label: 'Saved' },
];
const SORTS: { key: Sort; label: string }[] = [
  { key: 'new', label: 'Newest saved' }, { key: 'near', label: 'Closest' },
  { key: 'creator', label: 'Creator' }, { key: 'az', label: 'A to Z' },
];

/**
 * The signed-in page: Following (Latest from creators you follow, a Map of their spots and your lists, and
 * your Saved videos) and My Spots (your own synced spots, via the creator dashboard). Explore links to the home page.
 */
export default function FanPage() {
  const [uid, setUid] = useState<string | null | undefined>(undefined); // undefined = checking
  const [name, setName] = useState('');
  const [view, setView] = useState<View>('following');
  const [ftab, setFtab] = useState<FTab>('latest');
  const [jumpToMap, setJumpToMap] = useState(false); // an old /fan?view=map link: scroll to the map once the page is ready
  const [follows, setFollows] = useState<FanCreator[]>([]);
  const [creators, setCreators] = useState<FanCreator[]>([]);
  const [feed, setFeed] = useState<FanVideo[] | null>(null);
  const [saved, setSaved] = useState<SavedVideo[]>([]);
  const [lists, setLists] = useState<FanList[]>([]);
  const [sort, setSort] = useState<Sort>('new');
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [finding, setFinding] = useState(false);
  const [notice, setNotice] = useState('');
  const [discover, setDiscover] = useState<FanVideo[] | null>(null);
  const [dtypes, setDtypes] = useState<string[]>([]); // chosen discover types; empty = All

  const go = useCallback((v: View, t: FTab = 'latest') => {
    setView(v); setFtab(t);
    const url = new URL(window.location.href);
    if (v === 'following') url.searchParams.delete('view'); else url.searchParams.set('view', v);
    if (v === 'following' && t !== 'latest') url.searchParams.set('tab', t); else url.searchParams.delete('tab');
    url.searchParams.delete('list');
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
    // Older links: ?view=creator -> My Spots, ?view=videos -> Saved, ?view=map or lists -> scroll down to the map.
    const q = new URLSearchParams(window.location.search);
    const wanted = q.get('view'), wantedTab = q.get('tab');
    if (wanted === 'myspots' || wanted === 'creator') setView('myspots');
    else if (wanted === 'videos') setFtab('saved');
    else if (wanted === 'map' || wanted === 'lists' || q.get('list') || wantedTab === 'map') setJumpToMap(true);
    else if (wantedTab === 'saved') setFtab('saved');
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
      try {
        const saved = (localStorage.getItem('povgo-discover-type') || '').split(',').filter((k) => CONTENT_TYPES.some((t) => t.key === k));
        setDtypes(saved);
      } catch { /* private window */ }
      // If location was already allowed, use it straight away so "local" works without a tap.
      try {
        const perm = await navigator.permissions?.query({ name: 'geolocation' });
        if (perm?.state === 'granted') locate();
      } catch { /* not supported; the "Use my location" button still works */ }
    })();
  }, [loadFeed, loadDiscover, locate]);

  // Old links to the map (/fan?view=map, ?list=...) land on Following and scroll down to it.
  useEffect(() => {
    if (!jumpToMap || !uid) return;
    const t = setTimeout(() => document.getElementById('following-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
    return () => clearTimeout(t);
  }, [jumpToMap, uid]);

  // The Following map edits lists and saves on its own; pick up those changes so the Saved tab and the counts stay right.
  useEffect(() => {
    if (!uid) return;
    const reload = async () => {
      const supabase = getSupabase();
      const [s, l] = await Promise.all([
        supabase.from('saved_videos').select(`created_at, videos(${FAN_VIDEO_FIELDS})`).eq('user_id', uid).order('created_at', { ascending: false }),
        supabase.from('lists').select('id, name, list_items(video_id)').eq('user_id', uid).order('created_at'),
      ]);
      setSaved(((s.data ?? []) as unknown as { created_at: string; videos: FanVideo | null }[])
        .filter((r) => r.videos).map((r) => ({ savedAt: r.created_at, video: r.videos! })));
      setLists(((l.data ?? []) as unknown as { id: string; name: string; list_items: { video_id: string }[] }[])
        .map((r) => ({ id: r.id, name: r.name, videoIds: (r.list_items ?? []).map((i) => i.video_id) })));
    };
    window.addEventListener('povgo:lists-changed', reload);
    return () => window.removeEventListener('povgo:lists-changed', reload);
  }, [uid]);

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
      else flash('Saved');
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
    return data.id;
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

  /** Tap a type to add or remove it from the filter; "All" clears it. */
  function pickType(t: string) {
    const next = t === 'all' ? [] : dtypes.includes(t) ? dtypes.filter((x) => x !== t) : [...dtypes, t];
    setDtypes(next);
    try { localStorage.setItem('povgo-discover-type', next.join(',')); } catch { /* private window */ }
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
            <h1 className="text-2xl font-semibold text-ink">Your POVGo</h1>
            <p className="text-sm text-gray-600 mt-2">Follow creators, save the places you want to try, group them into lists and see them all on a map. Post your own spots too.</p>
            <div className="mt-6 grid gap-2">
              <Link href="/signup" className="btn-sun py-3 text-sm">Join POVGo</Link>
              <Link href="/login?next=/fan" className="btn-ghost py-3 text-sm">Sign in</Link>
              <Link href="/" className="text-sm font-bold text-glacier hover:underline mt-1">Just explore the map →</Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  // Discover: unfollowed creators, filtered by the chosen type, and by distance once location is on.
  const LOCAL_MILES = 50;
  const typed = (discover ?? []).filter((v) => dtypes.length === 0 || creatorTypes(v.creators).some((t) => dtypes.includes(t)));
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
  return (
    <>
      <SiteNav active="login" />
      <main className="flex-1 bg-cloud text-ink">
        <div className="max-w-5xl mx-auto px-4 pt-5 pb-28">
          {/* Who (the main navigation is the bar along the bottom) */}
          <header className="flex flex-wrap items-center gap-x-4 gap-y-3 mb-5">
            <div className="min-w-0">
              <h1 className="font-display text-2xl sm:text-3xl font-semibold leading-tight truncate">Hey, {name}</h1>
              <p className="text-xs sm:text-sm font-bold text-gray-500">
                {saved.length} saved · {lists.length} list{lists.length === 1 ? '' : 's'} · {follows.length} creator{follows.length === 1 ? '' : 's'}
              </p>
            </div>
          </header>

          {view === 'following' && (
            <div className="flex gap-1.5 mb-5 p-1 rounded-full bg-frost w-fit max-w-full overflow-x-auto" role="group" aria-label="Following">
              {FTABS.map((t) => (
                <button key={t.key} type="button" onClick={() => go('following', t.key)} aria-pressed={ftab === t.key}
                  className={`px-4 py-1.5 text-sm font-extrabold rounded-full whitespace-nowrap ${ftab === t.key ? 'bg-white shadow-sm text-ink' : 'text-gray-600'}`}>{t.label}</button>
              ))}
            </div>
          )}

          {view === 'following' && ftab === 'latest' && (
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
                  <button key={t.key} type="button" onClick={() => pickType(t.key)}
                    aria-pressed={t.key === 'all' ? dtypes.length === 0 : dtypes.includes(t.key)}
                    className={`px-3 py-1.5 text-xs font-extrabold rounded-full ${(t.key === 'all' ? dtypes.length === 0 : dtypes.includes(t.key)) ? 'bg-ink text-white' : 'bg-white text-ink border border-gray-200'}`}>
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
                <Empty>{dtypes.length === 0 ? 'No new creators to discover right now.' : 'No creators with these types yet. Try All.'}</Empty>
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

          {view === 'following' && ftab === 'saved' && (
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-baseline gap-2">Saved videos
                <span className="text-xs font-bold text-gray-500 font-sans">{saved.length} saved from creators</span></h2>
              {saved.length === 0 ? (
                <Empty>Nothing saved yet. Tap the heart on any video in your <button type="button" className="font-extrabold text-glacier underline" onClick={() => go('following')}>Latest</button> or on the <Link href="/" className="font-extrabold text-glacier underline">Explore</Link> map.</Empty>
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

          {view === 'following' && (
            <section id="following-map" aria-label="Following map" className="mt-10 scroll-mt-4">
              <h2 className="text-xl font-semibold mb-3">Map</h2>
              <FanMap mine />
            </section>
          )}

          {view === 'myspots' && <CreatorDashboard embedded />}
        </div>
      </main>

      <BottomNav active={view} onSelect={(v) => go(v)} />

      {notice && (
        <div role="status" className="pointer-events-none fixed left-1/2 -translate-x-1/2 bottom-24 z-[1200] bg-ink text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg">{notice}</div>
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
        <Link href={handle ? `/c/${handle}` : '/'} className="min-w-0 flex-1">
          <span className="block text-xs sm:text-sm font-extrabold truncate">{v.creators?.display_name || handle}</span>
          <span className="block text-[11px] font-bold text-gray-500 truncate">{timeAgo(v.posted_at)}</span>
        </Link>
        <Heart on={saved} onClick={onSave} name={v.place_name} />
      </div>
      {onFollow && <button type="button" onClick={onFollow} className="btn-ghost py-1.5 text-xs">+ Follow</button>}
    </article>
  );
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
