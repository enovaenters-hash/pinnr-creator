'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { inputClass } from '@/components/AuthCard';
import type { PreviewMapInfo, PreviewSpot } from '@/components/PreviewMap';

type Row = { handle: string; text: string; ok?: boolean };
const NEEDS_SQL = /preview_(maps|spots)|relation|schema cache/i;
const parseHandles = (s: string) =>
  [...new Set(s.split(/[\s,]+/).map((h) => h.replace(/^@/, '').replace(/^https?:\/\/(www\.)?tiktok\.com\/@/i, '').split(/[/?]/)[0].trim().toLowerCase())
    .filter((h) => /^[a-z0-9._]{2,40}$/.test(h)))];

/**
 * Admin > Creator Maps: paste TikTok @usernames, and POVGo builds each creator a map from their latest public videos
 * at /m/<handle>, to share in their comments. The maps aren't listed anywhere in the app. Needs supabase/preview-maps.sql.
 */
export default function AdminCreatorMaps() {
  const [maps, setMaps] = useState<PreviewMapInfo[]>([]);
  const [spots, setSpots] = useState<PreviewSpot[]>([]);
  const [ready, setReady] = useState(true);
  const [input, setInput] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const sb = getSupabase();
    const [m, s] = await Promise.all([
      sb.from('preview_maps').select('*').order('updated_at', { ascending: false }),
      sb.from('preview_spots').select('*').order('posted_at', { ascending: false, nullsFirst: false }).limit(5000),
    ]);
    if (m.error) { setReady(!NEEDS_SQL.test(m.error.message)); return; }
    setReady(true);
    setMaps((m.data as PreviewMapInfo[]) ?? []);
    setSpots((s.data as PreviewSpot[]) ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const byHandle = useMemo(() => {
    const out: Record<string, PreviewSpot[]> = {};
    spots.forEach((s) => { (out[s.handle] ??= []).push(s); });
    return out;
  }, [spots]);

  const link = (h: string) => `${window.location.origin}/m/${h}`;
  const comment = (h: string) => `Made you a map of all the spots you've posted 📍 ${link(h)}`;

  async function copy(text: string, key: string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000); }
    catch { setMsg({ text: 'Couldn’t copy. Long-press the link instead.', ok: false }); }
  }

  /** Build (or rebuild) each map one at a time, then keep placing addresses until none are left (or 5 rounds). */
  async function build(handles: string[]) {
    if (!handles.length) { setMsg({ text: 'Paste at least one TikTok @username.', ok: false }); return; }
    setBusy(true); setMsg(null);
    setRows(handles.map((h) => ({ handle: h, text: 'Waiting…' })));
    const update = (h: string, text: string, ok?: boolean) => setRows((rs) => rs.map((r) => (r.handle === h ? { ...r, text, ok } : r)));
    for (const h of handles) {
      update(h, 'Reading their TikToks…');
      try {
        const r = await api('/api/admin/preview-maps', { method: 'POST', body: JSON.stringify({ action: 'build', handle: h }) });
        let pending = r.pending as number;
        for (let i = 0; pending > 0 && i < 5; i++) {
          update(h, `Placing ${pending} address${pending === 1 ? '' : 'es'} on the map…`);
          pending = (await api('/api/admin/preview-maps', { method: 'POST', body: JSON.stringify({ action: 'geocode', handle: h }) })).pending;
        }
        update(h, `${r.spots} spot${r.spots === 1 ? '' : 's'} from ${r.checked} videos${pending ? ` (${pending} still to place)` : ''}`, true);
      } catch (e) {
        const m = (e as Error).message;
        update(h, NEEDS_SQL.test(m) ? 'Run supabase/preview-maps.sql in Supabase first.' : m, false);
      }
    }
    await load();
    setBusy(false);
    setInput('');
  }

  async function setHidden(s: PreviewSpot, hidden: boolean) {
    const { error } = await getSupabase().from('preview_spots').update({ hidden }).eq('id', s.id);
    if (error) { setMsg({ text: error.message, ok: false }); return; }
    setSpots((xs) => xs.map((x) => (x.id === s.id ? { ...x, hidden } : x)));
  }

  async function place(s: PreviewSpot) {
    const address = (edits[s.id] ?? s.address ?? '').trim();
    try {
      const r = await api('/api/admin/preview-maps', { method: 'POST', body: JSON.stringify({ action: 'place', id: s.id, address }) });
      setSpots((xs) => xs.map((x) => (x.id === s.id ? { ...x, address, lat: r.lat, lng: r.lng } : x)));
      setMsg({ text: `${s.place_name || 'Spot'} is on the map.`, ok: true });
    } catch (e) { setMsg({ text: (e as Error).message, ok: false }); }
  }

  async function remove(h: string) {
    const { error } = await getSupabase().from('preview_maps').delete().eq('handle', h);
    if (error) { setMsg({ text: error.message, ok: false }); return; }
    setMaps((ms) => ms.filter((m) => m.handle !== h));
    setSpots((xs) => xs.filter((x) => x.handle !== h));
    setConfirmDelete(null); setOpen(null);
    setMsg({ text: `@${h}'s map is deleted. The link no longer works.`, ok: true });
  }

  const handles = parseHandles(input);

  return (
    <section className="grid gap-4">
      <div className="card p-5">
        <h2 className="text-xl font-semibold">Creator maps</h2>
        <p className="text-sm text-gray-600 mt-1">
          Paste TikTok @usernames. Each creator gets a map of the places in their latest videos at povgo/m/&lt;handle&gt;, ready to drop in
          their comments. These maps don&apos;t show up in Explore, search or anywhere else in the app.
        </p>
        {!ready && <p className="mt-3 text-sm text-amber-700">Creator maps aren&apos;t switched on yet. Run <code>supabase/preview-maps.sql</code> in Supabase, then refresh.</p>}
        <textarea className={`${inputClass} mt-3 w-full`} rows={4} value={input} onChange={(e) => setInput(e.target.value)}
          placeholder={'@robbyspov1\n@phxfoodie\nhttps://www.tiktok.com/@azeats'} autoCapitalize="none" />
        <div className="mt-2 flex items-center gap-3">
          <button onClick={() => build(handles)} disabled={busy || !ready || !handles.length} className="btn-sun px-5 py-2 text-sm disabled:opacity-50">
            {busy ? 'Building…' : `Build ${handles.length || ''} map${handles.length === 1 ? '' : 's'}`}
          </button>
          <span className="text-xs text-gray-500">About 10–20 seconds each.</span>
        </div>
        {rows.length > 0 && (
          <ul className="mt-3 grid gap-1 text-sm">
            {rows.map((r) => (
              <li key={r.handle} className="flex gap-2">
                <span className="font-bold">@{r.handle}</span>
                <span className={r.ok === false ? 'text-red-700' : r.ok ? 'text-green-700' : 'text-gray-500'}>{r.text}</span>
              </li>
            ))}
          </ul>
        )}
        {msg && <p role="status" className={`mt-2 text-sm font-bold ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</p>}
      </div>

      {maps.length > 0 && (
        <ul className="grid gap-2">
          {maps.map((m) => {
            const list = byHandle[m.handle] ?? [];
            const onMap = list.filter((s) => s.lat !== null && !s.hidden).length;
            return (
              <li key={m.handle} className="card p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative w-10 h-10 rounded-full bg-frost overflow-hidden shrink-0 flex items-center justify-center font-bold text-glacier">
                    {m.handle.charAt(0).toUpperCase()}
                    {m.avatar_url && <img src={m.avatar_url} referrerPolicy="no-referrer" alt="" className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate">@{m.handle}</p>
                    <p className="text-xs text-gray-500">{onMap} on the map · {list.length} spot{list.length === 1 ? '' : 's'} found · /m/{m.handle}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => copy(comment(m.handle), `c-${m.handle}`)} className="btn-sun px-3 py-1 text-xs">{copied === `c-${m.handle}` ? 'Copied' : 'Copy comment'}</button>
                    <button onClick={() => copy(link(m.handle), `l-${m.handle}`)} className="btn-ghost px-3 py-1 text-xs">{copied === `l-${m.handle}` ? 'Copied' : 'Copy link'}</button>
                    <a href={`/m/${m.handle}`} target="_blank" rel="noopener" className="btn-ghost px-3 py-1 text-xs">View</a>
                    <button onClick={() => build([m.handle])} disabled={busy} className="btn-ghost px-3 py-1 text-xs disabled:opacity-50">Refresh</button>
                    <button onClick={() => setOpen(open === m.handle ? null : m.handle)} className="btn-ghost px-3 py-1 text-xs">{open === m.handle ? 'Close' : 'Spots'}</button>
                  </div>
                </div>

                {open === m.handle && (
                  <div className="mt-3 border-t border-frost pt-3">
                    {list.length === 0 ? (
                      <p className="text-sm text-gray-500">None of their latest videos named a place. Try again after they post more.</p>
                    ) : (
                      <ul className="grid gap-2">
                        {list.map((s) => (
                          <li key={s.id} className={`flex items-center gap-2 ${s.hidden ? 'opacity-50' : ''}`}>
                            <a href={s.video_url ?? '#'} target="_blank" rel="noopener" className="relative w-10 h-12 shrink-0 rounded-md overflow-hidden bg-frost">
                              {s.cover_url && <img src={s.cover_url} referrerPolicy="no-referrer" alt="" className="absolute inset-0 w-full h-full object-cover"
                                onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />}
                            </a>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold truncate">
                                {s.place_name || 'Spot'} {s.lat === null && <span className="text-amber-700 text-xs">· not on the map</span>}
                              </p>
                              <div className="flex gap-1">
                                <input className={`${inputClass} flex-1 !py-1 text-xs`} value={edits[s.id] ?? s.address ?? ''}
                                  onChange={(e) => setEdits((x) => ({ ...x, [s.id]: e.target.value }))} placeholder="Address, City, ST" />
                                {(s.lat === null || (edits[s.id] !== undefined && edits[s.id] !== s.address)) && (
                                  <button onClick={() => place(s)} className="btn-sun px-2 py-0.5 text-xs">Place</button>
                                )}
                              </div>
                            </div>
                            <button onClick={() => setHidden(s, !s.hidden)} className="btn-ghost px-2.5 py-1 text-xs shrink-0">{s.hidden ? 'Show' : 'Hide'}</button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-3 flex items-center gap-2">
                      {confirmDelete === m.handle ? (
                        <>
                          <span className="text-sm font-bold">Delete @{m.handle}&apos;s map?</span>
                          <button onClick={() => remove(m.handle)} className="px-3 py-1 rounded-full bg-red-600 text-white text-xs font-bold">Yes, delete</button>
                          <button onClick={() => setConfirmDelete(null)} className="btn-ghost px-3 py-1 text-xs">Cancel</button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDelete(m.handle)} className="btn-ghost px-3 py-1 text-xs text-red-700">Delete map</button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
