'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getSupabase } from '@/lib/supabase';

type Col = { id: string; name: string; total: number };
type Done = { name: string; found: number; withPlace: number; noPlace: number };
type Have = { collection_id: string | null; collection_name: string | null; n: number };

/**
 * "Import my TikTok collections": the fan types their TikTok @username, we list their PUBLIC collections, and
 * each one they import becomes a group on their Group Maps (spots come from TikTok's location tags and captions).
 */
export default function ImportCollections({ onChanged }: { onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState('');
  const [cols, setCols] = useState<Col[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<Done[]>([]);
  const [have, setHave] = useState<Have[]>([]);
  const [setupNeeded, setSetupNeeded] = useState(false);

  const loadHave = useCallback(async () => {
    const { data, error } = await getSupabase().from('imported_spots').select('collection_id, collection_name');
    if (error) { setSetupNeeded(/imported_spots|relation|schema cache/i.test(error.message)); return; }
    setSetupNeeded(false);
    const m = new Map<string, Have>();
    for (const r of (data ?? []) as { collection_id: string | null; collection_name: string | null }[]) {
      const k = r.collection_id ?? r.collection_name ?? '';
      const cur = m.get(k) ?? { collection_id: r.collection_id, collection_name: r.collection_name, n: 0 };
      cur.n++; m.set(k, cur);
    }
    setHave([...m.values()]);
  }, []);
  useEffect(() => { loadHave(); }, [loadHave]);

  async function find(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null); setCols(null); setDone([]);
    setBusy('find');
    try {
      const r = await api('/api/import/collections', { method: 'POST', body: JSON.stringify({ action: 'list', handle }) });
      setCols(r.collections as Col[]);
      if (!(r.collections as Col[]).length) {
        setMsg(`@${r.handle} has no public collections. In TikTok: Profile → bookmark tab → Collections → open one → set it to Public.`);
      }
    } catch (x) { setErr((x as Error).message); }
    setBusy(null);
  }

  async function importOne(c: Col) {
    setBusy(c.id); setErr(null);
    try {
      const r = await api('/api/import/collections', { method: 'POST', body: JSON.stringify({ action: 'import', handle, collectionId: c.id, name: c.name }) });
      let pending = r.pending as number;
      // Addresses without coordinates are placed a few at a time (about one per second).
      for (let i = 0; i < 6 && pending > 0; i++) {
        setMsg(`Placing ${pending} address${pending === 1 ? '' : 'es'} on the map…`);
        const g = await api('/api/import/collections', { method: 'POST', body: JSON.stringify({ action: 'geocode' }) });
        pending = g.pending as number;
      }
      setMsg(pending > 0 ? `${pending} more address${pending === 1 ? '' : 'es'} left to place. Tap Import again to finish.` : null);
      setDone((d) => [...d.filter((x) => x.name !== c.name), { name: c.name, found: r.found, withPlace: r.withPlace, noPlace: r.noPlace }]);
      await loadHave();
      onChanged();
    } catch (x) { setErr((x as Error).message); }
    setBusy(null);
  }

  async function importAll() {
    for (const c of cols ?? []) await importOne(c);
  }

  async function remove(h: Have) {
    if (!window.confirm(`Remove the imported spots from "${h.collection_name ?? 'this collection'}"? Your TikTok collection isn't changed.`)) return;
    const q = getSupabase().from('imported_spots').delete();
    const { error } = h.collection_id ? await q.eq('collection_id', h.collection_id) : await q.is('collection_id', null);
    if (error) { setErr(error.message); return; }
    await loadHave();
    onChanged();
  }

  return (
    <div className="mb-4">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="btn-sun px-4 py-2 text-sm inline-flex items-center gap-2">
        <span aria-hidden>⬆</span> Import my TikTok collections
      </button>

      {open && (
        <div className="card mt-3 p-4 bg-white rounded-2xl border border-gray-100">
          <p className="text-sm font-bold text-gray-600">
            Type your TikTok @username. We&apos;ll find your <b>public</b> collections and put each one on your map as its own group.
            To make a collection public: TikTok → Profile → bookmark tab → Collections → open it → set to Public.
          </p>

          {setupNeeded && (
            <p className="mt-3 text-sm font-extrabold text-amber-800 bg-amber-50 rounded-xl px-3 py-2">
              Imports need one setup step: run <code>supabase/imports.sql</code> in Supabase, then reload.
            </p>
          )}

          <form onSubmit={find} className="flex gap-2 mt-3">
            <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourusername" aria-label="Your TikTok username"
              autoCapitalize="none" autoCorrect="off" maxLength={40}
              className="min-w-0 flex-1 rounded-full border-2 border-gray-200 px-4 py-2 text-base outline-none focus:border-ice" />
            <button type="submit" disabled={!handle.trim() || busy !== null} className="btn-sun px-4 py-2 text-sm disabled:opacity-50">
              {busy === 'find' ? 'Looking…' : 'Find'}
            </button>
          </form>

          {err && <p role="alert" className="mt-3 text-sm font-extrabold text-red-700">{err}</p>}
          {msg && <p className="mt-3 text-sm font-bold text-gray-600">{msg}</p>}

          {cols && cols.length > 0 && (
            <div className="mt-3 grid gap-2">
              {cols.map((c) => {
                const d = done.find((x) => x.name === c.name);
                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-xl bg-cloud px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold truncate">{c.name}</div>
                      <div className="text-xs font-bold text-gray-500">
                        {c.total} video{c.total === 1 ? '' : 's'}
                        {d && ` · imported ${d.found}: ${d.withPlace} with a place${d.noPlace ? `, ${d.noPlace} without a location tag` : ''}`}
                      </div>
                    </div>
                    <button type="button" onClick={() => importOne(c)} disabled={busy !== null} className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-50">
                      {busy === c.id ? 'Importing…' : d ? 'Import again' : 'Import'}
                    </button>
                  </div>
                );
              })}
              {cols.length > 1 && (
                <button type="button" onClick={importAll} disabled={busy !== null} className="btn-sun px-4 py-2 text-sm justify-self-start disabled:opacity-50">
                  Import all {cols.length}
                </button>
              )}
            </div>
          )}

          {have.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">Already imported</h3>
              <div className="mt-1.5 grid gap-1.5">
                {have.map((h) => (
                  <div key={h.collection_id ?? h.collection_name} className="flex items-center gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate font-extrabold">{h.collection_name ?? 'Collection'}</span>
                    <span className="text-xs font-bold text-gray-500">{h.n} video{h.n === 1 ? '' : 's'}</span>
                    <button type="button" onClick={() => remove(h)} className="text-xs font-extrabold text-red-700 underline">Remove</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
