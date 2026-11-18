'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { getSupabase, supabaseConfigured } from '@/lib/supabase';
import { categoryColor, CONTENT_TYPES, creatorTypes, type Creator, type Video } from '@/lib/types';
import { api } from '@/lib/api';
import VideoEditForm from '@/components/VideoEditForm';
import ConnectedAccounts from '@/components/ConnectedAccounts';
import { NotConfigured, Switch, inputClass, primaryBtn } from '@/components/AuthCard';
import SiteNav from '@/components/SiteNav';
import type { MapPin } from '@/components/Map';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

type Filter = 'all' | 'needs' | 'mapped';

/** A creator's own group of videos, shown on their public page. */
type Group = { id: string; name: string; isPublic: boolean; videoIds: string[] };

/**
 * The creator dashboard. `embedded` drops the site bar and page frame so it can sit inside
 * the My Spots tab. Someone signed in without a creator profile sees "Share your own spots".
 */
export default function CreatorDashboard({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<{ text: string; tone: 'info' | 'ok' | 'err' } | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  /** False when the creator_groups table isn't set up yet (supabase/creator-groups.sql not run). */
  const [groupsReady, setGroupsReady] = useState(true);
  const [groupsFor, setGroupsFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { if (embedded) setLoading(false); else router.replace('/login'); return; }
    const [{ data: c }, { data: v }, g] = await Promise.all([
      supabase.from('creators').select('*').eq('id', session.user.id).maybeSingle(),
      supabase.from('videos').select('*').eq('creator_id', session.user.id)
        .order('posted_at', { ascending: false, nullsFirst: false }),
      supabase.from('creator_groups').select('id, name, is_public, creator_group_items(video_id)')
        .eq('creator_id', session.user.id).order('position').order('created_at'),
    ]);
    setCreator(c as Creator | null);
    setVideos((v as Video[]) ?? []);
    setGroupsReady(!g.error);
    setGroups(((g.data ?? []) as unknown as { id: string; name: string; is_public: boolean | null; creator_group_items: { video_id: string }[] }[])
      .map((r) => ({ id: r.id, name: r.name, isPublic: r.is_public !== false,
        videoIds: (r.creator_group_items ?? []).map((i) => i.video_id) })));
    setLoading(false);
  }, [router, embedded]);

  useEffect(() => {
    if (supabaseConfigured) load(); else setLoading(false);
  }, [load]);

  async function sync() {
    setSyncing(true);
    setStatus({ text: 'Checking TikTok for new videos…', tone: 'info' });
    try {
      const r = await api('/api/sync', { method: 'POST' });
      setStatus({
        text: [
          r.added ? `Added ${r.added} new video${r.added === 1 ? '' : 's'}` : `No new videos (checked ${r.checked})`,
          r.tagged ? `${r.tagged} placed from your TikTok location tags` : null,
          r.mapped ? `${r.mapped} placed on the map` : null,
          r.pending ? `${r.pending} more will be placed on your next sync` : null,
        ].filter(Boolean).join(' · '),
        tone: 'ok',
      });
      await load();
    } catch (e) {
      setStatus({ text: (e as Error).message, tone: 'err' });
    } finally {
      setSyncing(false);
    }
  }

  async function patch(id: string, body: Partial<Video>) {
    try {
      const r = await api(`/api/videos/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setVideos((vs) => vs.map((v) => (v.id === id ? r.video : v)));
      setStatus(r.warning ? { text: r.warning, tone: 'err' } : { text: 'Saved', tone: 'ok' });
      return !r.warning;
    } catch (e) {
      setStatus({ text: (e as Error).message, tone: 'err' });
      return false;
    }
  }

  /** Tap a type to add or remove it. At least one stays selected. */
  async function toggleType(type: string) {
    if (!creator) return;
    const now = creatorTypes(creator);
    const next = now.includes(type) ? now.filter((t) => t !== type) : [...now, type];
    if (next.length === 0) { setStatus({ text: 'Keep at least one content type selected.', tone: 'info' }); return; }
    // Keep them in the same order as the buttons so the list is tidy.
    const ordered = CONTENT_TYPES.map((t) => t.key as string).filter((k) => next.includes(k));
    const before = creator;
    setCreator({ ...creator, content_types: ordered, content_type: ordered[0] });
    const { error } = await getSupabase().from('creators')
      .update({ content_types: ordered, content_type: ordered[0] }).eq('id', creator.id);
    if (error) { setCreator(before); setStatus({ text: 'Couldn’t save your content types. Try again.', tone: 'err' }); }
    else setStatus({ text: 'Content types saved', tone: 'ok' });
  }

  async function createGroup(name: string): Promise<string | null> {
    const clean = name.trim().slice(0, 40);
    if (!clean || !creator) return null;
    const { data, error } = await getSupabase().from('creator_groups')
      .insert({ creator_id: creator.id, name: clean, position: groups.length }).select('id, name, is_public').single();
    if (error || !data) { setStatus({ text: 'Couldn’t create that group. Try again.', tone: 'err' }); return null; }
    setGroups((gs) => [...gs, { id: data.id, name: data.name, isPublic: data.is_public !== false, videoIds: [] }]);
    setStatus({ text: `Group “${data.name}” created`, tone: 'ok' });
    return data.id;
  }

  async function renameGroup(id: string, name: string) {
    const clean = name.trim().slice(0, 40);
    if (!clean) return;
    const before = groups;
    setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, name: clean } : g)));
    const { error } = await getSupabase().from('creator_groups').update({ name: clean }).eq('id', id);
    if (error) { setGroups(before); setStatus({ text: 'Couldn’t rename that group. Try again.', tone: 'err' }); }
  }

  async function setGroupPublic(id: string, isPublic: boolean) {
    const before = groups;
    setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, isPublic } : g)));
    const { error } = await getSupabase().from('creator_groups').update({ is_public: isPublic }).eq('id', id);
    if (error) { setGroups(before); setStatus({ text: 'Couldn’t change who can see that group. Try again.', tone: 'err' }); }
    else setStatus({ text: isPublic ? 'Group is public: fans can see it' : 'Group is private: only you can see it', tone: 'ok' });
  }

  async function deleteGroup(id: string) {
    const before = groups;
    setGroups((gs) => gs.filter((g) => g.id !== id));
    const { error } = await getSupabase().from('creator_groups').delete().eq('id', id);
    if (error) { setGroups(before); setStatus({ text: 'Couldn’t delete that group. Try again.', tone: 'err' }); }
    else setStatus({ text: 'Group deleted', tone: 'ok' });
  }

  async function toggleInGroup(groupId: string, videoId: string) {
    // A group made a moment ago may not be in this render's `groups` yet, so "not found" means "not in it".
    const has = groups.find((g) => g.id === groupId)?.videoIds.includes(videoId) ?? false;
    setGroups((gs) => gs.map((g) => g.id !== groupId ? g
      : { ...g, videoIds: has ? g.videoIds.filter((x) => x !== videoId) : [...g.videoIds, videoId] }));
    const supabase = getSupabase();
    const { error } = has
      ? await supabase.from('creator_group_items').delete().eq('group_id', groupId).eq('video_id', videoId)
      : await supabase.from('creator_group_items').insert({ group_id: groupId, video_id: videoId });
    if (error) setStatus({ text: 'Couldn’t update that group. Refresh and try again.', tone: 'err' });
  }

  async function signOut() {
    await getSupabase().auth.signOut();
    router.replace('/login');
  }

  const publicUrl = creator && typeof window !== 'undefined'
    ? `${window.location.origin}/c/${creator.tiktok_username}` : '';

  async function share() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setStatus({ text: 'Page link copied', tone: 'ok' });
    } catch {
      setStatus({ text: publicUrl, tone: 'info' });
    }
  }

  const mapped = videos.filter((v) => v.lat !== null && v.lng !== null);
  const featuredCount = videos.filter((v) => v.featured).length;
  const shown = videos.filter((v) =>
    filter === 'all' ? true : filter === 'mapped' ? v.lat !== null : v.lat === null);

  const pins: MapPin[] = useMemo(() => mapped.filter((v) => !v.hidden).map((v) => ({
    id: v.id, lat: v.lat!, lng: v.lng!,
    title: v.place_name || 'Untitled spot',
    subtitle: v.address, cover: v.cover_url, href: v.video_url,
    color: categoryColor(v.category),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [videos]);

  if (!supabaseConfigured) {
    return <main className="max-w-xl mx-auto p-6"><NotConfigured /></main>;
  }
  if (loading) {
    return <Shell embedded={embedded}><p className="py-16 text-center text-sm text-gray-500">Loading…</p></Shell>;
  }
  if (!creator) {
    return <Shell embedded={embedded}><BecomeCreator onDone={load} /></Shell>;
  }

  return (
    <Shell embedded={embedded}>
      <div>
        {/* Header — V16 full-width stack */}
        <header className={`card p-5 mb-6 ${embedded ? '' : 'mt-6'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-baseline gap-2 min-w-0">
              <h1 className="text-xl font-semibold truncate">{creator?.display_name || creator?.tiktok_username}</h1>
              <span className="text-sm text-gray-500 truncate">@{creator?.tiktok_username}</span>
            </div>
            <button onClick={signOut} className="text-xs text-gray-500 hover:text-gray-900">Sign out</button>
          </div>
          <button onClick={sync} disabled={syncing}
            className="btn-sun w-full py-3 text-sm">
            {syncing ? 'Syncing…' : 'Sync Videos'}
          </button>
          <div className="flex gap-2 mt-2">
            <button onClick={share} className="btn-ghost flex-1 py-2 text-sm">Share</button>
            <a href={publicUrl} target="_blank" rel="noopener"
              className="btn-ghost flex-1 py-2 text-sm text-center">View</a>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold text-gray-500 mb-1.5">What do you post? Pick all that apply. Fans use this to choose what to discover.</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Content types">
              {CONTENT_TYPES.map((t) => {
                const on = creatorTypes(creator).includes(t.key);
                return (
                  <button key={t.key} type="button" onClick={() => toggleType(t.key)} aria-pressed={on}
                    className={`px-3.5 py-1.5 text-xs font-extrabold rounded-full ${on ? 'bg-ink text-white' : 'bg-white text-ink border border-gray-200'}`}>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          <ConnectedAccounts onMessage={(text, tone) => setStatus({ text, tone })} onChanged={load} />
          {status && (
            <p className={`mt-3 text-sm ${status.tone === 'err' ? 'text-red-600' : status.tone === 'ok' ? 'text-green-700' : 'text-gray-600'}`}>
              {status.text}
            </p>
          )}
        </header>

        {/* Stats */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Stat label="Videos" value={videos.length} />
          <Stat label="On map" value={mapped.length} />
          <Stat label="Need location" value={videos.length - mapped.length} />
          <Stat label="Top picks" value={`${featuredCount}/3`} />
        </section>

        {/* Map */}
        <section className="mb-8">
          <div className="h-72 rounded-xl overflow-hidden border-2 border-white shadow-[0_6px_20px_rgba(19,41,58,.07)] relative z-0">
            <Map pins={pins} />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {creator?.last_synced_at ? `Last synced ${new Date(creator.last_synced_at).toLocaleString()}` : 'Never synced — tap Sync Videos to pull your latest TikToks.'}
          </p>
        </section>

        {/* Groups */}
        <GroupsPanel ready={groupsReady} groups={groups} onCreate={createGroup}
          onRename={renameGroup} onDelete={deleteGroup} onSetPublic={setGroupPublic} />

        {/* Videos */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Your videos</h2>
            <div className="flex gap-1 text-xs">
              {(['all', 'needs', 'mapped'] as Filter[]).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full border ${filter === f ? 'bg-ink text-white border-ink font-bold' : 'bg-white border-gray-200 text-gray-600 font-semibold'}`}>
                  {f === 'all' ? 'All' : f === 'needs' ? 'Needs location' : 'On map'}
                </button>
              ))}
            </div>
          </div>

          {videos.length === 0 && (
            <div className="text-center text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg py-10">
              No videos yet. Tap <strong>Sync Videos</strong> to pull your latest 20 TikToks.
            </div>
          )}

          <ul className="space-y-3">
            {shown.map((v) => (
              <li key={v.id} className="card p-3">
                <div className="flex gap-3">
                  {v.cover_url
                    ? <img src={v.cover_url} referrerPolicy="no-referrer" alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} className="w-16 h-24 object-cover rounded-md bg-gray-100 shrink-0" />
                    : <div className="w-16 h-24 rounded-md bg-gray-100 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{v.place_name || <span className="text-gray-400">No place name</span>}</p>
                        <p className={`text-xs truncate ${v.lat === null ? 'text-amber-600' : 'text-gray-500'}`}>
                          {v.lat !== null ? `📍 ${v.address}`
                            : !v.address ? '⚠ Needs an address — tap Edit'
                            : v.geocode_attempted ? `⚠ Couldn't find “${v.address}” — tap Edit`
                            : `⏳ ${v.address} (placing on next sync)`}
                        </p>
                      </div>
                      <button title={v.featured ? 'Remove from top picks' : 'Add to top picks (max 3)'}
                        onClick={() => patch(v.id, { featured: !v.featured })}
                        className={`text-lg leading-none ${v.featured ? 'text-amber-400' : 'text-gray-300 hover:text-amber-400'}`}>★</button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{v.caption}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                      {v.category && <span className="px-2 py-0.5 rounded-full text-white" style={{ background: categoryColor(v.category) }}>#{v.category}</span>}
                      {v.discount_code && <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Code: {v.discount_code}</span>}
                      {v.hidden && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Hidden</span>}
                      {v.posted_at && <span className="text-gray-400">{new Date(v.posted_at).toLocaleDateString()}</span>}
                      {groupsReady && (() => {
                        const n = groups.filter((g) => g.videoIds.includes(v.id)).length;
                        return (
                          <button onClick={() => setGroupsFor(groupsFor === v.id ? null : v.id)} aria-expanded={groupsFor === v.id}
                            className="ml-auto text-blue-600 font-medium">
                            {groupsFor === v.id ? 'Done' : n ? `In ${n} group${n === 1 ? '' : 's'}` : '+ Group'}
                          </button>
                        );
                      })()}
                      <button onClick={() => setEditingId(editingId === v.id ? null : v.id)}
                        className={`${groupsReady ? '' : 'ml-auto '}text-blue-600 font-medium`}>
                        {editingId === v.id ? 'Close' : 'Edit'}
                      </button>
                    </div>
                  </div>
                </div>
                {groupsFor === v.id && (
                  <GroupPicker videoId={v.id} groups={groups} onToggle={toggleInGroup} onCreate={createGroup} />
                )}
                {editingId === v.id && (
                  <VideoEditForm video={v} onCancel={() => setEditingId(null)}
                    onSave={async (body) => { if (await patch(v.id, body)) setEditingId(null); }} />
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Shell>
  );
}

/** Page frame: the full page (site bar + centered column) or nothing extra when embedded. */
function Shell({ embedded, children }: { embedded: boolean; children: React.ReactNode }) {
  if (embedded) return <>{children}</>;
  return (
    <>
      <SiteNav active="login" />
      <main className="flex-1 bg-cloud text-ink">
        <div className="max-w-5xl mx-auto px-4 pb-16">{children}</div>
      </main>
    </>
  );
}

/** Shown to a signed-in person with no creator profile: flip the Creator mode switch and add a TikTok username. */
function BecomeCreator({ onDone }: { onDone: () => void }) {
  const [on, setOn] = useState(false);
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const username = handle.replace(/^@/, '').trim().toLowerCase();
    if (!/^[a-z0-9._]{2,24}$/.test(username)) {
      setError('Enter a valid TikTok username (letters, numbers, . and _).');
      return;
    }
    setBusy(true);
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setBusy(false); setError('Please sign in again.'); return; }
    const { error } = await supabase.from('creators')
      .insert({ id: session.user.id, tiktok_username: username, display_name: username });
    setBusy(false);
    if (error) {
      setError(error.code === '23505' ? `@${username} already has a POVGo creator page.` : error.message);
      return;
    }
    onDone();
  }

  return (
    <div className="card p-6 max-w-md mx-auto my-8">
      <h2 className="text-2xl font-semibold text-center">My Spots</h2>
      <p className="text-sm text-gray-600 mt-2 text-center">Your own TikTok spots on the map, with a Top 3 page you can share.</p>
      <div className="mt-5">
        <Switch id="creator-mode" on={on} onChange={setOn} label="Creator mode" hint="Flip on and add your TikTok username." />
      </div>
      {on && (
        <form onSubmit={submit} className="mt-4 space-y-3 text-left">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">TikTok username</span>
            <div className="relative mt-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">@</span>
              <input id="become-creator-handle" className={`${inputClass} pl-8`} value={handle} onChange={(e) => setHandle(e.target.value)}
                placeholder="yourhandle" autoCapitalize="none" autoCorrect="off" required autoFocus />
            </div>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className={primaryBtn} disabled={busy}>{busy ? 'Turning on…' : 'Turn on creator mode'}</button>
        </form>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="font-display text-3xl font-semibold mt-1">{value}</div>
    </div>
  );
}

/** The creator's groups: make, rename and delete them. Spots are added from each video's "+ Group" button. */
function GroupsPanel({ ready, groups, onCreate, onRename, onDelete, onSetPublic }: {
  ready: boolean; groups: Group[];
  onCreate: (name: string) => Promise<string | null>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSetPublic: (id: string, isPublic: boolean) => Promise<void>;
}) {
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTo, setRenameTo] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  return (
    <section className="card p-5 mb-8" aria-labelledby="groups-heading">
      <h2 id="groups-heading" className="text-xl font-semibold">Your groups</h2>
      <p className="text-sm text-gray-600 mt-1">
        Bundle your spots into groups like <em>Date night</em> or <em>Best tacos</em>. Public groups show on your page; private ones only you can see.
      </p>
      {!ready ? (
        <p className="mt-3 text-sm text-amber-700">Groups aren&apos;t switched on yet. Run <code>supabase/creator-groups.sql</code> in Supabase, then refresh.</p>
      ) : (
        <>
          {groups.length > 0 && (
            <ul className="mt-4 space-y-2">
              {groups.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                  {renaming === g.id ? (
                    <form className="flex flex-1 gap-2 min-w-0" onSubmit={async (e) => {
                      e.preventDefault(); await onRename(g.id, renameTo); setRenaming(null);
                    }}>
                      <input value={renameTo} onChange={(e) => setRenameTo(e.target.value)} maxLength={40} autoFocus
                        aria-label={`New name for ${g.name}`} className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded-md text-sm" />
                      <button className="btn-sun px-3 py-1 text-xs">Save</button>
                      <button type="button" onClick={() => setRenaming(null)} className="text-xs text-gray-500">Cancel</button>
                    </form>
                  ) : (
                    <>
                      <span className="font-semibold text-sm truncate">{g.name}</span>
                      <span className="text-xs text-gray-500">{g.videoIds.length} spot{g.videoIds.length === 1 ? '' : 's'}</span>
                      <span className="inline-flex p-0.5 rounded-full bg-frost text-[11px] font-extrabold" role="group" aria-label={`Who can see ${g.name}`}>
                        <button type="button" onClick={() => !g.isPublic && onSetPublic(g.id, true)} aria-pressed={g.isPublic}
                          className={`px-2.5 py-1 rounded-full ${g.isPublic ? 'bg-ink text-white' : 'text-gray-600'}`}>Public</button>
                        <button type="button" onClick={() => g.isPublic && onSetPublic(g.id, false)} aria-pressed={!g.isPublic}
                          className={`px-2.5 py-1 rounded-full ${!g.isPublic ? 'bg-ink text-white' : 'text-gray-600'}`}>Private</button>
                      </span>
                      <span className="ml-auto flex items-center gap-4 text-xs">
                        {confirmDelete === g.id ? (
                          <>
                            <span className="text-gray-600">Delete this group?</span>
                            <button onClick={async () => { await onDelete(g.id); setConfirmDelete(null); }} className="text-red-600 font-bold">Delete</button>
                            <button onClick={() => setConfirmDelete(null)} className="text-gray-500">Keep</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setRenaming(g.id); setRenameTo(g.name); }} className="text-blue-600 font-medium">Rename</button>
                            <button onClick={() => setConfirmDelete(g.id)} className="text-gray-500 hover:text-red-600">Delete</button>
                          </>
                        )}
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          <form className="mt-3 flex gap-2" onSubmit={async (e) => {
            e.preventDefault();
            if (await onCreate(newName)) setNewName('');
          }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40} placeholder="New group name"
              aria-label="New group name" className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-full text-sm" />
            <button className="btn-sun px-4 py-2 text-sm" disabled={!newName.trim()}>+ Add group</button>
          </form>
          {groups.length > 0 && (
            <p className="text-xs text-gray-500 mt-2">Add spots with the <strong>+ Group</strong> button on any video below.</p>
          )}
        </>
      )}
    </section>
  );
}

/** Under a video: tap a group to add or remove this video, or make a new group with it. */
function GroupPicker({ videoId, groups, onToggle, onCreate }: {
  videoId: string; groups: Group[];
  onToggle: (groupId: string, videoId: string) => Promise<void>;
  onCreate: (name: string) => Promise<string | null>;
}) {
  const [newName, setNewName] = useState('');
  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Groups for this video">
        {groups.map((g) => {
          const inIt = g.videoIds.includes(videoId);
          return (
            <button key={g.id} type="button" onClick={() => onToggle(g.id, videoId)} aria-pressed={inIt}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-full ${inIt ? 'bg-ink text-white' : 'bg-white text-ink border border-gray-200'}`}>
              {inIt ? '✓ ' : ''}{g.name}{g.isPublic ? '' : ' 🔒'}
            </button>
          );
        })}
      </div>
      <form className="mt-2 flex gap-2" onSubmit={async (e) => {
        e.preventDefault();
        const id = await onCreate(newName);
        if (id) { await onToggle(id, videoId); setNewName(''); }
      }}>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40} placeholder="New group with this spot"
          aria-label="New group name" className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded-md text-sm" />
        <button className="btn-ghost px-3 py-1.5 text-xs" disabled={!newName.trim()}>Create</button>
      </form>
    </div>
  );
}
