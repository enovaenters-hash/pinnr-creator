'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getSupabase, supabaseConfigured } from '@/lib/supabase';
import { api } from '@/lib/api';
import { categoryColor, type Creator, type Video } from '@/lib/types';
import type { PublicVideo } from '@/components/PublicMap';
import VideoEditForm from '@/components/VideoEditForm';
import { NotConfigured } from '@/components/AuthCard';

type Tab = 'featured' | 'locations' | 'creators';
type Status = 'loading' | 'signedOut' | 'denied' | 'ready';

/** Admin: pick Featured Locations for the home screen, edit any creator's spots, see all creators. */
export default function AdminPage() {
  const [status, setStatus] = useState<Status>('loading');
  const [tab, setTab] = useState<Tab>('featured');
  const [videos, setVideos] = useState<PublicVideo[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [slots, setSlots] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [me, setMe] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setStatus('signedOut'); return; }
    const { data: admin } = await supabase.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
    if (!admin) { setStatus('denied'); return; }
    setMe(session.user.id);
    const [v, c, f] = await Promise.all([
      supabase.from('videos').select('*, creators(tiktok_username, display_name, avatar_url)')
        .order('created_at', { ascending: false }).order('posted_at', { ascending: false }).limit(5000),
      supabase.from('creators').select('*').order('created_at', { ascending: false }),
      supabase.from('featured_locations').select('slot, video_id'),
    ]);
    setVideos((v.data as PublicVideo[]) ?? []);
    setCreators((c.data as Creator[]) ?? []);
    setSlots(Object.fromEntries(((f.data ?? []) as { slot: number; video_id: string }[]).map((r) => [r.slot, r.video_id])));
    setStatus('ready');
  }, []);

  useEffect(() => { if (supabaseConfigured) load(); }, [load]);

  async function setSlot(slot: number, videoId: string | null) {
    const supabase = getSupabase();
    const ops = [];
    // A spot can only hold one slot.
    for (const [s, id] of Object.entries(slots)) {
      if (videoId && id === videoId && Number(s) !== slot) ops.push(supabase.from('featured_locations').delete().eq('slot', Number(s)));
    }
    ops.push(videoId
      ? supabase.from('featured_locations').upsert({ slot, video_id: videoId, updated_at: new Date().toISOString() })
      : supabase.from('featured_locations').delete().eq('slot', slot));
    const results = await Promise.all(ops);
    const failed = results.find((r) => r.error);
    if (failed?.error) { setMsg({ text: failed.error.message, err: true }); return; }
    setSlots((prev) => {
      const next: Record<number, string> = {};
      for (const [s, id] of Object.entries(prev)) if (id !== videoId) next[Number(s)] = id;
      if (videoId) next[slot] = videoId; else delete next[slot];
      return next;
    });
    setMsg({ text: videoId ? `Featured #${slot} updated — live on the home screen.` : `Featured #${slot} cleared.` });
  }

  async function saveVideo(id: string, body: Partial<Video>) {
    try {
      const r = await api(`/api/videos/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setVideos((vs) => vs.map((v) => (v.id === id ? { ...v, ...r.video } : v)));
      setMsg(r.warning ? { text: r.warning, err: true } : { text: 'Saved' });
      return !r.warning;
    } catch (e) {
      setMsg({ text: (e as Error).message, err: true });
      return false;
    }
  }

  /** Permanently remove a creator: their login, profile, videos and any Featured Location of theirs. */
  async function deleteCreator(c: Creator) {
    const { error } = await getSupabase().rpc('admin_delete_creator', { target: c.id });
    if (error) { setMsg({ text: error.message, err: true }); return false; }
    const gone = new Set(videos.filter((v) => v.creator_id === c.id).map((v) => v.id));
    setCreators((cs) => cs.filter((x) => x.id !== c.id));
    setVideos((vs) => vs.filter((v) => v.creator_id !== c.id));
    setSlots((sl) => Object.fromEntries(Object.entries(sl).filter(([, id]) => !gone.has(id))));
    setMsg({ text: `@${c.tiktok_username} and their ${gone.size} video${gone.size === 1 ? '' : 's'} were deleted.` });
    return true;
  }

  if (!supabaseConfigured) return <main className="max-w-xl mx-auto p-6"><NotConfigured /></main>;
  if (status === 'loading') return <Center>Loading…</Center>;
  if (status === 'signedOut') return <Center><Link href="/login?next=/admin" className="text-blue-600 font-medium">Sign in</Link> to use the admin page.</Center>;
  if (status === 'denied') return <Center>This account doesn&apos;t have admin access. <Link href="/" className="text-blue-600">Home</Link></Center>;

  return (
    <main className="flex-1 bg-white text-gray-900">
      <div className="max-w-5xl mx-auto px-4 pb-16">
        <header className="py-5 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Pinnr Admin</h1>
            <p className="text-xs text-gray-500">{creators.length} creators · {videos.length} videos · {videos.filter((v) => v.lat !== null).length} on map</p>
          </div>
          <div className="flex gap-2 text-xs">
            <Link href="/" className="px-3 py-1.5 rounded-full border border-gray-200 hover:border-gray-400">Home</Link>
            <Link href="/map" className="px-3 py-1.5 rounded-full border border-gray-200 hover:border-gray-400">Fan view</Link>
          </div>
        </header>

        <nav className="flex gap-1 border-b border-gray-200 mb-4 text-sm">
          {([['featured', 'Featured Locations'], ['locations', 'All Locations'], ['creators', 'Creators']] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => { setTab(t); setMsg(null); }}
              className={`px-3 py-2 -mb-px border-b-2 ${tab === t ? 'border-gray-900 font-semibold' : 'border-transparent text-gray-500'}`}>
              {label}
            </button>
          ))}
        </nav>

        {msg && <p className={`mb-4 text-sm ${msg.err ? 'text-red-600' : 'text-green-700'}`}>{msg.text}</p>}

        {tab === 'featured' && <FeaturedTab videos={videos} slots={slots} onSet={setSlot} />}
        {tab === 'locations' && <LocationsTab videos={videos} creators={creators} onSave={saveVideo} />}
        {tab === 'creators' && <CreatorsTab creators={creators} videos={videos} me={me} onDelete={deleteCreator} />}
      </div>
    </main>
  );
}

// ─── Featured Locations ─────────────────────────────────────────────────────────

function FeaturedTab({ videos, slots, onSet }: {
  videos: PublicVideo[]; slots: Record<number, string>; onSet: (slot: number, id: string | null) => Promise<void>;
}) {
  const [picking, setPicking] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const byId = useMemo(() => Object.fromEntries(videos.map((v) => [v.id, v])), [videos]);
  const eligible = videos.filter((v) => v.lat !== null && !v.hidden);
  const term = q.trim().toLowerCase();
  const matches = (term
    ? eligible.filter((v) => [v.place_name, v.address, v.category, v.creators?.tiktok_username, v.caption]
        .some((s) => s?.toLowerCase().includes(term)))
    : eligible).slice(0, 50);

  return (
    <div>
      <p className="text-sm text-gray-500 mb-3">These 3 spots show at the top of the home screen.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map((slot) => {
          const v = slots[slot] ? byId[slots[slot]] : undefined;
          return (
            <div key={slot} className={`rounded-xl border p-3 ${picking === slot ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200'}`}>
              <p className="text-xs font-semibold text-gray-500 mb-2">★ Featured #{slot}</p>
              {v ? <MiniSpot v={v} /> : <p className="text-sm text-gray-400 py-6 text-center">Empty</p>}
              <div className="flex gap-2 mt-3">
                <button onClick={() => { setPicking(picking === slot ? null : slot); setQ(''); }}
                  className="flex-1 py-1.5 text-sm rounded-md bg-blue-600 text-white font-medium">
                  {picking === slot ? 'Cancel' : v ? 'Change' : 'Choose'}
                </button>
                {v && <button onClick={() => onSet(slot, null)} className="px-3 py-1.5 text-sm rounded-md border border-gray-200">Remove</button>}
              </div>
            </div>
          );
        })}
      </div>

      {picking !== null && (
        <div className="mt-5 border border-gray-200 rounded-xl p-3">
          <p className="text-sm font-semibold mb-2">Choose a spot for Featured #{picking}</p>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search place, address, category or @creator"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {matches.map((v) => (
              <li key={v.id} className="flex items-center gap-3 py-2">
                <div className="flex-1 min-w-0"><MiniSpot v={v} /></div>
                <button onClick={async () => { await onSet(picking, v.id); setPicking(null); }}
                  className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:border-blue-500 shrink-0">Use</button>
              </li>
            ))}
            {matches.length === 0 && <li className="py-4 text-sm text-gray-500">No mapped spots match.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── All Locations ──────────────────────────────────────────────────────────────

function LocationsTab({ videos, creators, onSave }: {
  videos: PublicVideo[]; creators: Creator[]; onSave: (id: string, body: Partial<Video>) => Promise<boolean>;
}) {
  const [creator, setCreator] = useState('');
  const [state, setState] = useState<'all' | 'mapped' | 'needs' | 'hidden'>('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const term = q.trim().toLowerCase();

  const shown = videos.filter((v) =>
    (!creator || v.creator_id === creator) &&
    (state === 'all' || (state === 'mapped' && v.lat !== null && !v.hidden) || (state === 'needs' && v.lat === null) || (state === 'hidden' && v.hidden)) &&
    (!term || [v.place_name, v.address, v.caption, v.creators?.tiktok_username].some((s) => s?.toLowerCase().includes(term))));

  const field = 'px-2 py-1.5 border border-gray-300 rounded-md text-sm';
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <select className={field} value={creator} onChange={(e) => setCreator(e.target.value)}>
          <option value="">All creators</option>
          {creators.map((c) => <option key={c.id} value={c.id}>@{c.tiktok_username}</option>)}
        </select>
        <select className={field} value={state} onChange={(e) => setState(e.target.value as typeof state)}>
          <option value="all">Any status</option>
          <option value="mapped">On map</option>
          <option value="needs">Needs location</option>
          <option value="hidden">Hidden</option>
        </select>
        <input className={`${field} flex-1 min-w-40`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
      </div>
      <p className="text-xs text-gray-500 mb-2">{shown.length} videos</p>
      <ul className="space-y-2">
        {shown.slice(0, 200).map((v) => (
          <li key={v.id} className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0"><MiniSpot v={v} showStatus /></div>
              <button onClick={() => setEditing(editing === v.id ? null : v.id)} className="text-sm text-blue-600 font-medium shrink-0">
                {editing === v.id ? 'Close' : 'Edit'}
              </button>
            </div>
            {editing === v.id && (
              <VideoEditForm video={v} onCancel={() => setEditing(null)}
                onSave={async (body) => { if (await onSave(v.id, body)) setEditing(null); }} />
            )}
          </li>
        ))}
      </ul>
      {shown.length > 200 && <p className="text-xs text-gray-500 mt-2">Showing first 200 — narrow with filters.</p>}
    </div>
  );
}

// ─── Creators ───────────────────────────────────────────────────────────────────

function CreatorsTab({ creators, videos, me, onDelete }: {
  creators: Creator[]; videos: PublicVideo[]; me: string | null; onDelete: (c: Creator) => Promise<boolean>;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const stats = useMemo(() => {
    const s: Record<string, { total: number; mapped: number }> = {};
    videos.forEach((v) => {
      s[v.creator_id] ??= { total: 0, mapped: 0 };
      s[v.creator_id].total++;
      if (v.lat !== null && !v.hidden) s[v.creator_id].mapped++;
    });
    return s;
  }, [videos]);

  return (
    <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl">
      {creators.map((c) => (
        <li key={c.id} className="p-3 flex flex-wrap items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-semibold flex items-center justify-center shrink-0">
            {(c.display_name || c.tiktok_username).charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-40">
            <p className="text-sm font-semibold">{c.display_name || c.tiktok_username} <span className="font-normal text-gray-500">@{c.tiktok_username}</span></p>
            <p className="text-xs text-gray-500">
              {stats[c.id]?.total ?? 0} video{(stats[c.id]?.total ?? 0) === 1 ? "" : "s"} · {stats[c.id]?.mapped ?? 0} on map · joined {new Date(c.created_at).toLocaleDateString()}
              {c.last_synced_at ? ` · synced ${new Date(c.last_synced_at).toLocaleDateString()}` : ' · never synced'}
            </p>
          </div>
          <div className="flex gap-2 text-xs">
            <Link href={`/map?creator=${c.tiktok_username}`} className="px-3 py-1.5 rounded-full border border-gray-200 hover:border-gray-400">Map</Link>
            <a href={`https://www.tiktok.com/@${c.tiktok_username}`} target="_blank" rel="noopener" className="px-3 py-1.5 rounded-full border border-gray-200 hover:border-gray-400">TikTok ↗</a>
            {c.id !== me && (
              <button onClick={() => { setConfirming(confirming === c.id ? null : c.id); setTyped(''); }}
                className="px-3 py-1.5 rounded-full border border-red-200 text-red-600 hover:bg-red-50">Delete</button>
            )}
          </div>
          {confirming === c.id && (
            <div className="w-full mt-1 p-3 rounded-lg bg-red-50 border border-red-200 text-sm">
              <p className="text-red-800">
                This permanently deletes <strong>@{c.tiktok_username}</strong>: their login, profile and all {stats[c.id]?.total ?? 0} videos.
                It can&apos;t be undone. Type <strong>{c.tiktok_username}</strong> to confirm.
              </p>
              <div className="flex gap-2 mt-2">
                <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={c.tiktok_username}
                  className="flex-1 min-w-0 px-2 py-1.5 border border-red-300 rounded-md text-sm bg-white" autoCapitalize="none" />
                <button disabled={busy || typed.trim().replace(/^@/, '').toLowerCase() !== c.tiktok_username}
                  onClick={async () => { setBusy(true); if (await onDelete(c)) setConfirming(null); setBusy(false); }}
                  className="px-3 py-1.5 rounded-md bg-red-600 text-white font-medium disabled:bg-red-300">
                  {busy ? 'Deleting…' : 'Delete forever'}
                </button>
                <button onClick={() => setConfirming(null)} className="px-3 py-1.5 rounded-md border border-gray-300 bg-white">Cancel</button>
              </div>
            </div>
          )}
        </li>
      ))}
      {creators.length === 0 && <li className="p-4 text-sm text-gray-500">No creators yet.</li>}
    </ul>
  );
}

// ─── Shared bits ────────────────────────────────────────────────────────────────

function MiniSpot({ v, showStatus }: { v: PublicVideo; showStatus?: boolean }) {
  return (
    <div className="flex gap-3 min-w-0">
      {v.cover_url
        ? <img src={v.cover_url} referrerPolicy="no-referrer" alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} className="w-10 h-14 object-cover rounded bg-gray-100 shrink-0" />
        : <div className="w-10 h-14 rounded bg-gray-100 shrink-0" />}
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{v.place_name || <span className="text-gray-400">No place name</span>}</p>
        <p className="text-xs text-gray-500 truncate">{v.address || v.caption}</p>
        <div className="flex flex-wrap gap-2 mt-0.5 text-xs">
          {v.creators && <span className="text-gray-500">@{v.creators.tiktok_username}</span>}
          {v.category && <span style={{ color: categoryColor(v.category) }}>#{v.category}</span>}
          {showStatus && v.hidden && <span className="text-gray-500">Hidden</span>}
          {showStatus && v.lat === null && <span className="text-amber-600">Needs location</span>}
        </div>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="flex-1 flex items-center justify-center p-6 text-sm text-gray-600 text-center">{children}</main>;
}
