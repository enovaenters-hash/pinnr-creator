'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { getSupabase, supabaseConfigured } from '@/lib/supabase';
import { CATEGORIES, categoryColor, type Creator, type Video } from '@/lib/types';
import { NotConfigured } from '@/components/AuthCard';
import type { MapPin } from '@/components/Map';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

type Filter = 'all' | 'needs' | 'mapped';

async function api(path: string, init: RequestInit = {}) {
  const { data } = await getSupabase().auth.getSession();
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session?.access_token ?? ''}`,
      ...(init.headers ?? {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}

export default function Dashboard() {
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
    if (!session) { router.replace('/login'); return; }
    const [{ data: c }, { data: v }] = await Promise.all([
      supabase.from('creators').select('*').eq('id', session.user.id).single(),
      supabase.from('videos').select('*').eq('creator_id', session.user.id)
        .order('posted_at', { ascending: false, nullsFirst: false }),
    ]);
    setCreator(c as Creator | null);
    setVideos((v as Video[]) ?? []);
    setLoading(false);
  }, [router]);

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

  async function signOut() {
    await getSupabase().auth.signOut();
    router.replace('/login');
  }

  const publicUrl = creator && typeof window !== 'undefined'
    ? `${window.location.origin}/c/${creator.tiktok_username}` : '';

  async function share() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setStatus({ text: 'Map link copied', tone: 'ok' });
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
    return <main className="flex-1 flex items-center justify-center text-sm text-gray-500">Loading…</main>;
  }

  return (
    <main className="flex-1 bg-white text-gray-900">
      <div className="max-w-5xl mx-auto px-4 pb-16">
        {/* Header — V16 full-width stack */}
        <header className="py-6 border-b border-gray-200 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-baseline gap-2 min-w-0">
              <h1 className="text-base font-semibold truncate">{creator?.display_name || creator?.tiktok_username}</h1>
              <span className="text-sm text-gray-500 truncate">@{creator?.tiktok_username}</span>
            </div>
            <button onClick={signOut} className="text-xs text-gray-500 hover:text-gray-900">Sign out</button>
          </div>
          <button onClick={sync} disabled={syncing}
            className="w-full py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:bg-gray-400">
            {syncing ? 'Syncing…' : 'Sync Videos'}
          </button>
          <div className="flex gap-2 mt-2">
            <button onClick={share} className="flex-1 py-2 rounded-md border border-gray-200 text-sm font-medium hover:border-blue-500">Share</button>
            <a href={publicUrl} target="_blank" rel="noopener"
              className="flex-1 py-2 rounded-md border border-gray-200 text-sm font-medium text-center hover:border-blue-500">View</a>
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
          <Stat label="Featured" value={`${featuredCount}/3`} />
        </section>

        {/* Map */}
        <section className="mb-8">
          <div className="h-72 rounded-lg overflow-hidden border border-gray-200 relative z-0">
            <Map pins={pins} />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {creator?.last_synced_at ? `Last synced ${new Date(creator.last_synced_at).toLocaleString()}` : 'Never synced — tap Sync Videos to pull your latest TikToks.'}
          </p>
        </section>

        {/* Videos */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Your videos</h2>
            <div className="flex gap-1 text-xs">
              {(['all', 'needs', 'mapped'] as Filter[]).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full border ${filter === f ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600'}`}>
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
              <li key={v.id} className="border border-gray-200 rounded-lg p-3">
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
                      <button title={v.featured ? 'Unfeature' : 'Feature (top 3)'}
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
                  <EditForm video={v} onCancel={() => setEditingId(null)}
                    onSave={async (body) => { if (await patch(v.id, body)) setEditingId(null); }} />
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function EditForm({ video, onSave, onCancel }: {
  video: Video;
  onSave: (body: Partial<Video>) => Promise<void>;
  onCancel: () => void;
}) {
  const [placeName, setPlaceName] = useState(video.place_name ?? '');
  const [category, setCategory] = useState(video.category ?? '');
  const [address, setAddress] = useState(video.address ?? '');
  const [discount, setDiscount] = useState(video.discount_code ?? '');
  const [hidden, setHidden] = useState(video.hidden);
  const [saving, setSaving] = useState(false);
  const field = 'w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <form className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        await onSave({ place_name: placeName, category: category || null, address, discount_code: discount, hidden });
        setSaving(false);
      }}>
      <label className="text-xs text-gray-600">Place name
        <input className={field} value={placeName} onChange={(e) => setPlaceName(e.target.value)} placeholder="Joe's Pizza" />
      </label>
      <label className="text-xs text-gray-600">Category
        <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">—</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="text-xs text-gray-600 sm:col-span-2">Address
        <input className={field} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="7 Carmine St, New York, NY" />
      </label>
      <label className="text-xs text-gray-600">Discount code <span className="text-gray-400">(optional)</span>
        <input className={field} value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="SAMS10" />
      </label>
      <label className="text-xs text-gray-600 flex items-center gap-2 sm:mt-5">
        <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> Hide from my public map
      </label>
      <div className="sm:col-span-2 flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm rounded-md border border-gray-200">Cancel</button>
        <button disabled={saving} className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white font-medium disabled:bg-gray-400">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
