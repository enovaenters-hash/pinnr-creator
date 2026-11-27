'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { inputClass } from '@/components/AuthCard';
import { matchesKey, normKey, type BusinessInfo } from '@/lib/business';
import type { PublicVideo } from '@/components/PublicMap';

const BLANK = (name: string): BusinessInfo => {
  const key = normKey(name).slice(0, 60);
  return { slug: key, name: name.trim().slice(0, 80), match_key: key, bio: '', address: '', website: '', top_video_ids: [] };
};
const NEEDS_SQL = /business_pages|relation|schema cache/i;

/**
 * Admin > Business Pages: make and edit /p/<slug> pages. Set the name, bio, address and website, see every creator
 * video that matches the spot, and pick its Top 3. Needs supabase/business-pages.sql.
 */
export default function AdminBusinesses({ videos }: { videos: PublicVideo[] }) {
  const [pages, setPages] = useState<BusinessInfo[]>([]);
  const [ready, setReady] = useState(true);
  const [edit, setEdit] = useState<BusinessInfo | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [orig, setOrig] = useState<string | null>(null); // slug the page had when opened
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await getSupabase().from('business_pages').select('*').order('name');
    if (error) { setReady(!NEEDS_SQL.test(error.message)); return; }
    setReady(true);
    setPages((data as BusinessInfo[]) ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const countFor = useCallback((key: string) => videos.filter((v) => matchesKey(v, key)).length, [videos]);

  // Spots creators post most that don't have a page yet: one tap to start one.
  const suggestions = useMemo(() => {
    const taken = new Set(pages.map((p) => p.match_key));
    const by: Record<string, { name: string; count: number }> = {};
    videos.forEach((v) => {
      const k = normKey(v.place_name);
      if (k.length < 2 || v.hidden) return;
      by[k] ??= { name: v.place_name!, count: 0 };
      by[k].count++;
    });
    return Object.entries(by).filter(([k]) => ![...taken].some((t) => k.includes(t)))
      .sort((a, b) => b[1].count - a[1].count).slice(0, 8).map(([, x]) => x);
  }, [videos, pages]);

  function open(p: BusinessInfo, fresh = false) { setEdit({ ...p }); setIsNew(fresh); setOrig(fresh ? null : p.slug); setMsg(null); setConfirmDelete(false); }

  function startNew(name: string) {
    const p = BLANK(name);
    if (p.slug.length < 2) { setMsg({ text: 'Type the business name first.', ok: false }); return; }
    const existing = pages.find((x) => x.slug === p.slug);
    if (existing) { open(existing); return; }
    // Prefill the address from the creators' videos.
    const vs = videos.filter((v) => matchesKey(v, p.match_key));
    p.address = vs.find((v) => v.address)?.address ?? '';
    if (!name.trim() && vs[0]?.place_name) p.name = vs[0].place_name;
    open(p, true);
    setNewName('');
  }

  const set = <K extends keyof BusinessInfo>(k: K, v: BusinessInfo[K]) => setEdit((e) => (e ? { ...e, [k]: v } : e));

  const matched = useMemo(() => (edit ? videos.filter((v) => matchesKey(v, normKey(edit.match_key))) : []), [edit, videos]);

  function toggleTop(id: string) {
    if (!edit) return;
    const ids = edit.top_video_ids;
    if (ids.includes(id)) set('top_video_ids', ids.filter((x) => x !== id));
    else if (ids.length < 3) set('top_video_ids', [...ids, id]);
    else setMsg({ text: 'Top 3 is full. Tap a numbered video to take it out first.', ok: false });
  }

  async function save() {
    if (!edit) return;
    const row: BusinessInfo = {
      slug: normKey(edit.slug).slice(0, 60), name: edit.name.trim().slice(0, 80), match_key: normKey(edit.match_key).slice(0, 60),
      bio: edit.bio.trim().slice(0, 600), address: edit.address.trim().slice(0, 200), website: edit.website.trim().slice(0, 300),
      top_video_ids: edit.top_video_ids.slice(0, 3), updated_at: new Date().toISOString(),
    };
    if (row.slug.length < 2 || row.match_key.length < 2 || !row.name) { setMsg({ text: 'Name, link and match name need at least 2 letters or numbers.', ok: false }); return; }
    if (row.website && !/^https:\/\//i.test(row.website)) { setMsg({ text: 'The website must start with https://', ok: false }); return; }
    if (row.slug !== orig && pages.some((p) => p.slug === row.slug)) { setMsg({ text: `povgo/p/${row.slug} already exists.`, ok: false }); return; }
    setBusy(true); setMsg(null);
    const sb = getSupabase();
    const { error } = await sb.from('business_pages').upsert(row);
    // Renamed link: remove the old row.
    if (!error && orig && orig !== row.slug) await sb.from('business_pages').delete().eq('slug', orig);
    setBusy(false);
    if (error) { setMsg({ text: NEEDS_SQL.test(error.message) ? 'Run supabase/business-pages.sql in Supabase first.' : error.message, ok: false }); return; }
    await load();
    setEdit(row);
    setOrig(row.slug);
    setIsNew(false);
    setMsg({ text: 'Saved. The page is live.', ok: true });
  }

  async function remove() {
    if (!edit) return;
    const { error } = await getSupabase().from('business_pages').delete().eq('slug', orig ?? edit.slug);
    if (error) { setMsg({ text: error.message, ok: false }); return; }
    setPages((ps) => ps.filter((p) => p.slug !== (orig ?? edit.slug)));
    setEdit(null);
    setMsg({ text: 'Page deleted. Creator videos are untouched.', ok: true });
  }

  /* ---------- list ---------- */
  if (!edit) {
    return (
      <section className="grid gap-4">
        <div className="card p-5">
          <h2 className="text-xl font-semibold">Business pages</h2>
          <p className="text-sm text-gray-600 mt-1">
            One page per spot at povgo/p/&lt;name&gt;, with every creator video about it. You set the bio, address, website and Top 3.
            Creator videos can&apos;t be edited or hidden from here.
          </p>
          {!ready && <p className="mt-3 text-sm text-amber-700">Business pages aren&apos;t switched on yet. Run <code>supabase/business-pages.sql</code> in Supabase, then refresh.</p>}
          <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); startNew(newName); }}>
            <input className={`${inputClass} flex-1`} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Business name, e.g. Thaitanic Kitchen" />
            <button className="btn-sun px-4 py-2 text-sm" disabled={!ready}>New page</button>
          </form>
          {msg && <p role="status" className={`mt-2 text-sm font-bold ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</p>}
        </div>

        {pages.length > 0 && (
          <ul className="grid gap-2">
            {pages.map((p) => (
              <li key={p.slug} className="card p-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate">{p.name}</p>
                  <p className="text-xs text-gray-500 truncate">/p/{p.slug} · {countFor(p.match_key)} videos · Top 3: {p.top_video_ids.length ? `${p.top_video_ids.length} picked` : 'newest'}</p>
                </div>
                <a href={`/p/${p.slug}`} target="_blank" rel="noopener" className="btn-ghost px-3 py-1 text-xs">View</a>
                <button onClick={() => open(p)} className="btn-sun px-3 py-1 text-xs">Edit</button>
              </li>
            ))}
          </ul>
        )}

        {ready && suggestions.length > 0 && (
          <div className="card p-4">
            <h3 className="text-sm font-extrabold text-gray-600">Most-posted spots without a page</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button key={s.name} onClick={() => startNew(s.name)} className="btn-ghost px-3 py-1 text-xs">
                  + {s.name} <span className="text-gray-400">({s.count})</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  }

  /* ---------- editor ---------- */
  const slugKey = normKey(edit.slug);
  return (
    <section className="grid gap-4">
      <div className="flex items-center gap-2">
        <button onClick={() => { setEdit(null); setMsg(null); }} className="btn-ghost px-3 py-1 text-xs">← All pages</button>
        {!isNew && <a href={`/p/${slugKey}`} target="_blank" rel="noopener" className="btn-ghost px-3 py-1 text-xs ml-auto">View page ↗</a>}
      </div>

      <div className="card p-5 grid gap-3">
        <h2 className="text-xl font-semibold">{isNew ? 'New business page' : edit.name}</h2>
        <label className="grid gap-1 text-sm font-bold">Name
          <input className={inputClass} value={edit.name} maxLength={80} onChange={(e) => set('name', e.target.value)} />
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm font-bold">Page link
            <div className="flex items-center gap-1">
              <span className="text-gray-500 text-sm">/p/</span>
              <input className={`${inputClass} flex-1`} value={edit.slug} onChange={(e) => set('slug', normKey(e.target.value))} autoCapitalize="none" />
            </div>
          </label>
          <label className="grid gap-1 text-sm font-bold">Match videos whose place name contains
            <input className={inputClass} value={edit.match_key} onChange={(e) => set('match_key', normKey(e.target.value))} autoCapitalize="none" />
          </label>
        </div>
        <label className="grid gap-1 text-sm font-bold">Bio
          <textarea className={inputClass} rows={3} maxLength={600} value={edit.bio} onChange={(e) => set('bio', e.target.value)}
            placeholder="Family-owned Thai kitchen in Tempe. Known for…" />
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm font-bold">Address
            <input className={inputClass} value={edit.address} maxLength={200} onChange={(e) => set('address', e.target.value)} placeholder="4435 S Rural Rd, Tempe, AZ 85282" />
          </label>
          <label className="grid gap-1 text-sm font-bold">Website
            <input className={inputClass} value={edit.website} onChange={(e) => set('website', e.target.value)} placeholder="https://…" inputMode="url" autoCapitalize="none" />
          </label>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-lg font-semibold">Creator videos ({matched.length})</h3>
        <p className="text-sm text-gray-600">Tap up to 3 to make the Top 3, in the order you tap them. With none picked, the newest 3 show.</p>
        {matched.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No videos match “{edit.match_key}” yet. Try a shorter match name.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-2">
            {matched.map((v) => {
              const rank = edit.top_video_ids.indexOf(v.id) + 1;
              return (
                <li key={v.id}>
                  <button type="button" onClick={() => toggleTop(v.id)} aria-pressed={rank > 0}
                    className={`relative block w-full aspect-[3/4] rounded-xl overflow-hidden bg-frost border-4 ${rank ? 'border-sun' : 'border-transparent'}`}>
                    {v.cover_url && <img src={v.cover_url} referrerPolicy="no-referrer" alt="" className="absolute inset-0 w-full h-full object-cover" />}
                    {rank > 0 && (
                      <span className="absolute top-1 left-1 rounded-full bg-sun px-2 py-0.5 text-xs font-extrabold text-ink">#{rank}</span>
                    )}
                    {v.hidden && <span className="absolute top-1 right-1 rounded-full bg-ink/80 px-1.5 text-[10px] font-bold text-white">hidden</span>}
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1.5 pt-5 text-left text-white">
                      <span className="block truncate text-[11px] font-extrabold">@{v.creators?.tiktok_username}</span>
                      <span className="block truncate text-[10px] opacity-80">{v.place_name}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={busy || !ready} className="btn-sun px-5 py-2 text-sm disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
        {!isNew && (confirmDelete ? (
          <>
            <span className="text-sm font-bold">Delete this page?</span>
            <button onClick={remove} className="px-3 py-1.5 rounded-full bg-red-600 text-white text-sm font-bold">Yes, delete</button>
            <button onClick={() => setConfirmDelete(false)} className="btn-ghost px-3 py-1.5 text-sm">Cancel</button>
          </>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="btn-ghost px-3 py-1.5 text-sm text-red-700">Delete page</button>
        ))}
        {msg && <span role="status" className={`text-sm font-bold ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</span>}
      </div>
    </section>
  );
}
