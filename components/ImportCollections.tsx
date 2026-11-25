'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import { getSupabase } from '@/lib/supabase';
import { categoryColor } from '@/lib/types';
import type { MapPin } from '@/components/Map';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

type Spot = {
  id: string; collection_id: string | null; collection_name: string | null; tiktok_id: string;
  author_handle: string | null; place_name: string | null; address: string | null; category: string | null;
  cover_url: string | null; video_url: string | null; lat: number | null; lng: number | null;
  geocode_attempted: boolean; is_public: boolean;
};
type Col = { key: string; collectionId: string | null; name: string; isPublic: boolean; spots: Spot[] };
type Found = { id: string; name: string; total: number };
type Done = { name: string; found: number; withPlace: number; noPlace: number };

const PALETTE = ['#e8590c', '#2fb77a', '#8a5cf0', '#e05aa8', '#0ea5a4', '#d9480f', '#4263eb', '#a8872c'];

/**
 * My Spots › "Imported collections": bring in a person's PUBLIC TikTok collections, see them on a map, rename them,
 * make each one public (shown on their creator page) or private, remove single spots, or delete a collection.
 * `canPublish` is false for people without a creator page: they can import, but only privately.
 */
export default function ImportCollections({ canPublish }: { canPublish: boolean }) {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [ready, setReady] = useState(true);
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState('');
  const [found, setFound] = useState<Found[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<Done[]>([]);
  const [sel, setSel] = useState<string>('all');
  const [openCol, setOpenCol] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTo, setRenameTo] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [editSpot, setEditSpot] = useState<string | null>(null);
  const [editAddr, setEditAddr] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await getSupabase().from('imported_spots').select('*').order('created_at', { ascending: true }).limit(3000);
    if (error) { setReady(!/imported_spots|relation|schema cache|is_public/i.test(error.message)); return; }
    setReady(true);
    setSpots((data ?? []) as Spot[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const cols: Col[] = useMemo(() => {
    const m = new globalThis.Map<string, Col>();
    for (const s of spots) {
      const key = s.collection_id ?? s.collection_name ?? 'tiktok';
      const c = m.get(key) ?? { key, collectionId: s.collection_id, name: s.collection_name || 'TikTok collection', isPublic: s.is_public, spots: [] };
      c.spots.push(s); m.set(key, c);
    }
    return [...m.values()];
  }, [spots]);

  const pins: MapPin[] = useMemo(() => cols.flatMap((c, i) => (sel === 'all' || sel === c.key) ? c.spots
    .filter((s) => s.lat !== null && s.lng !== null)
    .map((s) => ({
      id: s.id, lat: s.lat!, lng: s.lng!, title: s.place_name || s.address || 'Spot', subtitle: s.address,
      cover: s.cover_url, href: s.video_url, color: PALETTE[i % PALETTE.length] || categoryColor(s.category),
    })) : []), [cols, sel]);

  // Every spot of a collection shares its collection id (older rows without one are matched by name).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filterCol = (c: Col) => (q: any) => (c.collectionId
    ? q.eq('collection_id', c.collectionId)
    : q.is('collection_id', null).eq('collection_name', c.name));

  async function rename(c: Col) {
    const name = renameTo.trim().slice(0, 60);
    setRenaming(null);
    if (!name || name === c.name) return;
    const { error } = await filterCol(c)(getSupabase().from('imported_spots').update({ collection_name: name }));
    if (error) setErr('Couldn’t rename that collection. Try again.'); else { setErr(null); await load(); }
  }
  async function setPublic(c: Col, v: boolean) {
    setSpots((ss) => ss.map((s) => (c.spots.some((x) => x.id === s.id) ? { ...s, is_public: v } : s)));
    const { error } = await filterCol(c)(getSupabase().from('imported_spots').update({ is_public: v }));
    if (error) { setErr('Couldn’t change who can see that collection. Try again.'); await load(); }
    else { setErr(null); setMsg(v ? `“${c.name}” is public: fans see it on your page.` : `“${c.name}” is private: only you can see it.`); }
  }
  async function deleteCol(c: Col) {
    setConfirmDel(null);
    const { error } = await filterCol(c)(getSupabase().from('imported_spots').delete());
    if (error) setErr('Couldn’t delete that collection. Try again.'); else { setErr(null); setMsg(`Deleted “${c.name}”. Your TikTok collection isn’t changed.`); if (sel === c.key) setSel('all'); await load(); }
  }
  async function removeSpot(s: Spot) {
    setSpots((ss) => ss.filter((x) => x.id !== s.id));
    const { error } = await getSupabase().from('imported_spots').delete().eq('id', s.id);
    if (error) { setErr('Couldn’t remove that spot.'); await load(); }
  }
  async function saveAddress(s: Spot) {
    const address = editAddr.trim();
    setEditSpot(null);
    if (!address) return;
    setBusy(s.id);
    const { error } = await getSupabase().from('imported_spots').update({ address, lat: null, lng: null, geocode_attempted: false }).eq('id', s.id);
    if (error) { setErr('Couldn’t save that address.'); setBusy(null); return; }
    try { await api('/api/import/collections', { method: 'POST', body: JSON.stringify({ action: 'geocode' }) }); } catch { /* shown as "couldn't find" below */ }
    await load(); setBusy(null);
  }

  async function find(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null); setFound(null); setDone([]); setBusy('find');
    try {
      const r = await api('/api/import/collections', { method: 'POST', body: JSON.stringify({ action: 'list', handle }) });
      setFound(r.collections as Found[]);
      if (!(r.collections as Found[]).length) {
        setMsg(`@${r.handle} has no public collections. In TikTok: Profile → bookmark tab → Collections → open one → set it to Public.`);
      }
    } catch (x) { setErr((x as Error).message); }
    setBusy(null);
  }
  async function importOne(c: Found) {
    setBusy(c.id); setErr(null);
    try {
      const r = await api('/api/import/collections', { method: 'POST', body: JSON.stringify({ action: 'import', handle, collectionId: c.id, name: c.name }) });
      let pending = r.pending as number;
      for (let i = 0; i < 6 && pending > 0; i++) {
        setMsg(`Placing ${pending} address${pending === 1 ? '' : 'es'} on the map…`);
        const g = await api('/api/import/collections', { method: 'POST', body: JSON.stringify({ action: 'geocode' }) });
        pending = g.pending as number;
      }
      setMsg(pending > 0 ? `${pending} more address${pending === 1 ? '' : 'es'} left to place. Tap Import again to finish.` : null);
      setDone((d) => [...d.filter((x) => x.name !== c.name), { name: c.name, found: r.found, withPlace: r.withPlace, noPlace: r.noPlace }]);
      await load();
    } catch (x) { setErr((x as Error).message); }
    setBusy(null);
  }
  async function importAll() { for (const c of found ?? []) await importOne(c); }

  const spotCount = (n: number) => `${n} spot${n === 1 ? '' : 's'}`;

  return (
    <section className="card p-5 mb-8" aria-labelledby="imports-heading">
      <h2 id="imports-heading" className="text-xl font-semibold">Imported collections</h2>
      <p className="text-sm text-gray-600 mt-1">
        Bring in your public TikTok collections and map them. {canPublish
          ? 'Public collections show on your page; private ones only you can see.'
          : 'They stay private. Switch on Creator mode to publish collections on your own page.'}
      </p>

      {!ready && (
        <p className="mt-3 text-sm text-amber-700">Imports aren&apos;t switched on yet. Run <code>supabase/imports.sql</code> in Supabase, then refresh.</p>
      )}

      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="btn-sun px-4 py-2 text-sm mt-3 inline-flex items-center gap-2">
        <span aria-hidden>⬆</span> Import my TikTok collections
      </button>

      {open && (
        <div className="mt-3 rounded-xl bg-cloud p-4">
          <p className="text-sm font-bold text-gray-600">
            Type your TikTok @username. We&apos;ll find your <b>public</b> collections. To make one public: TikTok → Profile → bookmark tab → Collections → open it → set to Public.
          </p>
          <form onSubmit={find} className="flex gap-2 mt-3">
            <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourusername" aria-label="Your TikTok username"
              autoCapitalize="none" autoCorrect="off" maxLength={40}
              className="min-w-0 flex-1 rounded-full border-2 border-gray-200 bg-white px-4 py-2 text-base outline-none focus:border-ice" />
            <button type="submit" disabled={!handle.trim() || busy !== null} className="btn-sun px-4 py-2 text-sm disabled:opacity-50">
              {busy === 'find' ? 'Looking…' : 'Find'}
            </button>
          </form>
          {found && found.length > 0 && (
            <div className="mt-3 grid gap-2">
              {found.map((c) => {
                const d = done.find((x) => x.name === c.name);
                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2">
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
              {found.length > 1 && (
                <button type="button" onClick={importAll} disabled={busy !== null} className="btn-sun px-4 py-2 text-sm justify-self-start disabled:opacity-50">
                  Import all {found.length}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {err && <p role="alert" className="mt-3 text-sm font-extrabold text-red-700">{err}</p>}
      {msg && <p className="mt-3 text-sm font-bold text-gray-600">{msg}</p>}

      {cols.length > 0 && (
        <>
          {/* Map of the imported spots; tap a collection chip to focus it */}
          <div className="flex flex-wrap gap-1.5 mt-4" role="group" aria-label="Show on map">
            <button type="button" onClick={() => setSel('all')} aria-pressed={sel === 'all'}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-full ${sel === 'all' ? 'bg-ink text-white' : 'bg-white text-ink border border-gray-200'}`}>All</button>
            {cols.map((c, i) => (
              <button key={c.key} type="button" onClick={() => setSel(c.key)} aria-pressed={sel === c.key}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-full inline-flex items-center gap-1.5 ${sel === c.key ? 'bg-ink text-white' : 'bg-white text-ink border border-gray-200'}`}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />{c.name}
              </button>
            ))}
          </div>
          <div className="h-72 mt-3 rounded-xl overflow-hidden border-2 border-white shadow-[0_6px_20px_rgba(19,41,58,.07)] relative z-0">
            <Map pins={pins} />
          </div>
          <p className="text-xs text-gray-500 mt-2">{spotCount(pins.length)} on the map</p>

          <ul className="mt-4 space-y-2">
            {cols.map((c) => {
              const placed = c.spots.filter((s) => s.lat !== null).length;
              return (
                <li key={c.key} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {renaming === c.key ? (
                      <form className="flex flex-1 gap-2 min-w-0" onSubmit={(e) => { e.preventDefault(); rename(c); }}>
                        <input value={renameTo} onChange={(e) => setRenameTo(e.target.value)} maxLength={60} autoFocus aria-label={`New name for ${c.name}`}
                          className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded-md text-sm" />
                        <button className="btn-sun px-3 py-1 text-xs">Save</button>
                        <button type="button" onClick={() => setRenaming(null)} className="text-xs text-gray-500">Cancel</button>
                      </form>
                    ) : (
                      <>
                        <button type="button" onClick={() => setOpenCol(openCol === c.key ? null : c.key)} aria-expanded={openCol === c.key}
                          className="font-semibold text-sm truncate text-left">{openCol === c.key ? '▾' : '▸'} {c.name}</button>
                        <span className="text-xs text-gray-500">{spotCount(c.spots.length)}{placed < c.spots.length ? ` · ${c.spots.length - placed} not on map` : ''}</span>
                        {canPublish && (
                          <span className="inline-flex p-0.5 rounded-full bg-frost text-[11px] font-extrabold" role="group" aria-label={`Who can see ${c.name}`}>
                            <button type="button" onClick={() => !c.isPublic && setPublic(c, true)} aria-pressed={c.isPublic}
                              className={`px-2.5 py-1 rounded-full ${c.isPublic ? 'bg-ink text-white' : 'text-gray-600'}`}>Public</button>
                            <button type="button" onClick={() => c.isPublic && setPublic(c, false)} aria-pressed={!c.isPublic}
                              className={`px-2.5 py-1 rounded-full ${!c.isPublic ? 'bg-ink text-white' : 'text-gray-600'}`}>Private</button>
                          </span>
                        )}
                        <span className="ml-auto flex items-center gap-4 text-xs">
                          {confirmDel === c.key ? (
                            <>
                              <span className="text-gray-600">Delete this collection?</span>
                              <button onClick={() => deleteCol(c)} className="text-red-600 font-bold">Delete</button>
                              <button onClick={() => setConfirmDel(null)} className="text-gray-500">Keep</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => { setRenaming(c.key); setRenameTo(c.name); }} className="text-blue-600 font-medium">Rename</button>
                              <button onClick={() => setConfirmDel(c.key)} className="text-gray-500 hover:text-red-600">Delete</button>
                            </>
                          )}
                        </span>
                      </>
                    )}
                  </div>

                  {openCol === c.key && (
                    <ul className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                      {c.spots.map((s) => (
                        <li key={s.id} className="flex gap-3">
                          {s.cover_url
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={s.cover_url} referrerPolicy="no-referrer" alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} className="w-12 h-16 object-cover rounded-md bg-gray-100 shrink-0" />
                            : <div className="w-12 h-16 rounded-md bg-gray-100 shrink-0" />}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{s.place_name || <span className="text-gray-400">No place name</span>}</p>
                            {editSpot === s.id ? (
                              <form className="flex gap-2 mt-1" onSubmit={(e) => { e.preventDefault(); saveAddress(s); }}>
                                <input value={editAddr} onChange={(e) => setEditAddr(e.target.value)} autoFocus placeholder="Street, City, ST" aria-label="Address"
                                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded-md text-sm" />
                                <button className="btn-sun px-3 py-1 text-xs">Save</button>
                                <button type="button" onClick={() => setEditSpot(null)} className="text-xs text-gray-500">Cancel</button>
                              </form>
                            ) : (
                              <p className={`text-xs truncate ${s.lat === null ? 'text-amber-600' : 'text-gray-500'}`}>
                                {busy === s.id ? '⏳ Placing…'
                                  : s.lat !== null ? `📍 ${s.address}`
                                  : !s.address ? '⚠ No location tag — add an address'
                                  : s.geocode_attempted ? `⚠ Couldn’t find “${s.address}” — fix the address`
                                  : `⏳ ${s.address}`}
                              </p>
                            )}
                            <div className="flex gap-4 mt-1 text-xs">
                              {s.video_url && <a href={s.video_url} target="_blank" rel="noopener" className="text-blue-600 font-medium">▶ TikTok</a>}
                              <button onClick={() => { setEditSpot(s.id); setEditAddr(s.address ?? ''); }} className="text-blue-600 font-medium">
                                {s.lat === null ? 'Add address' : 'Edit address'}
                              </button>
                              <button onClick={() => removeSpot(s)} className="text-gray-500 hover:text-red-600">Remove</button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
