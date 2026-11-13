'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { getSupabase, supabaseConfigured } from '@/lib/supabase';
import { categoryColor, CONTENT_TYPES, type Creator, type Video } from '@/lib/types';
import { api } from '@/lib/api';
import VideoEditForm from '@/components/VideoEditForm';
import { NotConfigured, inputClass, primaryBtn } from '@/components/AuthCard';
import SiteNav from '@/components/SiteNav';
import type { MapPin } from '@/components/Map';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

type Filter = 'all' | 'needs' | 'mapped';

/**
 * The creator dashboard. `embedded` drops the site bar and page frame so it can sit inside
 * the fan page's Creator tab. Someone signed in without a creator profile sees "Become a creator".
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

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { if (embedded) setLoading(false); else router.replace('/login'); return; }
    const [{ data: c }, { data: v }] = await Promise.all([
      supabase.from('creators').select('*').eq('id', session.user.id).maybeSingle(),
      supabase.from('videos').select('*').eq('creator_id', session.user.id)
        .order('posted_at', { ascending: false, nullsFirst: false }),
    ]);
    setCreator(c as Creator | null);
    setVideos((v as Video[]) ?? []);
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

  async function setType(type: string) {
    if (!creator || creator.content_type === type) return;
    const before = creator;
    setCreator({ ...creator, content_type: type });
    const { error } = await getSupabase().from('creators').update({ content_type: type }).eq('id', creator.id);
    if (error) { setCreator(before); setStatus({ text: 'Couldn’t save your content type. Try again.', tone: 'err' }); }
    else setStatus({ text: 'Content type saved', tone: 'ok' });
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
            <p className="text-xs font-bold text-gray-500 mb-1.5">What do you post? Fans use this to choose what to discover.</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Content type">
              {CONTENT_TYPES.map((t) => {
                const on = (creator.content_type ?? 'food') === t.key;
                return (
                  <button key={t.key} type="button" onClick={() => setType(t.key)} aria-pressed={on}
                    className={`px-3.5 py-1.5 text-xs font-extrabold rounded-full ${on ? 'bg-ink text-white' : 'bg-white text-ink border border-gray-200'}`}>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
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
                      <button onClick={() => setEditingId(editingId === v.id ? null : v.id)} className="ml-auto text-blue-600 font-medium">
                        {editingId === v.id ? 'Close' : 'Edit'}
                      </button>
                    </div>
                  </div>
                </div>
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

/** Shown to a signed-in person with no creator profile: add a TikTok username to become one. */
function BecomeCreator({ onDone }: { onDone: () => void }) {
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
    <div className="card p-6 max-w-md mx-auto my-8 text-center">
      <h2 className="text-2xl font-semibold">Become a creator</h2>
      <p className="text-sm text-gray-600 mt-2">Add your TikTok username and your own videos land on the map, with a Top 3 page you can share.</p>
      <form onSubmit={submit} className="mt-5 space-y-3 text-left">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">TikTok username</span>
          <div className="relative mt-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">@</span>
            <input id="become-creator-handle" className={`${inputClass} pl-8`} value={handle} onChange={(e) => setHandle(e.target.value)}
              placeholder="yourhandle" autoCapitalize="none" autoCorrect="off" required />
          </div>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className={primaryBtn} disabled={busy}>{busy ? 'Setting up…' : 'Connect my TikTok'}</button>
      </form>
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
