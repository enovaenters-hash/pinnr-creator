'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { inputClass } from '@/components/AuthCard';

type Row = { code: string; owner: string | null; house: boolean; total: number; d1: number; d7: number; d30: number };

const clean = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 20);

/**
 * Admin > Referrals. House codes (like POVGO) belong to no creator: add, rename or delete them here.
 * Every code on the site is listed with signups for Today / 7 days / 30 days / all time.
 * Needs supabase/referrals-admin.sql; until it has been run this shows a short note instead.
 */
export default function AdminReferrals() {
  const [rows, setRows] = useState<Row[]>([]);
  const [ready, setReady] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [rename, setRename] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await getSupabase().rpc('admin_referral_overview');
    if (error) { setReady(false); setLoaded(true); return; }
    setRows(((data ?? []) as Record<string, unknown>[]).map((r) => ({
      code: String(r.code), owner: (r.owner as string | null) ?? null, house: Boolean(r.house),
      total: Number(r.total) || 0, d1: Number(r.d1) || 0, d7: Number(r.d7) || 0, d30: Number(r.d30) || 0,
    })));
    setReady(true); setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  function fail(error: { code?: string; message: string }, code: string) {
    setMsg({
      text: error.code === '23505' ? `${code} is already taken. Try another.`
        : /3 to 20/.test(error.message) ? 'Use 3 to 20 letters or numbers, no spaces.' : error.message,
      ok: false,
    });
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const code = clean(draft);
    if (code.length < 3) { setMsg({ text: 'Use 3 to 20 letters or numbers, no spaces.', ok: false }); return; }
    setBusy(true); setMsg(null);
    const { error } = await getSupabase().rpc('admin_add_house_code', { p_code: code });
    setBusy(false);
    if (error) { fail(error, code); return; }
    setDraft(''); setMsg({ text: `${code} added. People can sign up with it now.`, ok: true });
    load();
  }

  async function saveRename(oldCode: string) {
    const code = clean(rename);
    if (code === oldCode) { setEditing(null); return; }
    if (code.length < 3) { setMsg({ text: 'Use 3 to 20 letters or numbers, no spaces.', ok: false }); return; }
    setBusy(true); setMsg(null);
    const { error } = await getSupabase().rpc('admin_rename_house_code', { p_old: oldCode, p_new: code });
    setBusy(false);
    if (error) { fail(error, code); return; }
    setEditing(null); setMsg({ text: `${oldCode} is now ${code}. ${oldCode} no longer works for new signups.`, ok: true });
    load();
  }

  async function remove(r: Row) {
    const houseLeft = rows.filter((x) => x.house).length;
    const warn = houseLeft <= 1 ? '\n\nThis is your only house code. New people will need a creator’s code to join.' : '';
    if (!window.confirm(`Delete ${r.code}? People can’t sign up with it any more.${warn}`)) return;
    const { error } = await getSupabase().rpc('admin_delete_house_code', { p_code: r.code });
    if (error) { setMsg({ text: error.message, ok: false }); return; }
    setMsg({ text: `${r.code} deleted`, ok: true });
    load();
  }

  async function copy(code: string) {
    const link = `${window.location.origin}/signup?ref=${code}`;
    try { await navigator.clipboard.writeText(link); setMsg({ text: 'Signup link copied. The code is filled in for them.', ok: true }); }
    catch { setMsg({ text: link, ok: true }); }
  }

  if (loaded && !ready) {
    return (
      <div className="card p-4">
        <h2 className="text-lg font-semibold">Referral codes</h2>
        <p className="text-sm text-gray-500 mt-1">
          This tab isn’t switched on yet. Run <code>supabase/referrals.sql</code> and then <code>supabase/referrals-admin.sql</code> once in the Supabase SQL Editor.
        </p>
      </div>
    );
  }

  const house = rows.filter((r) => r.house);
  const creators = rows.filter((r) => !r.house);

  const table = (list: Row[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 text-right">
            <th className="text-left font-semibold pb-1">Code</th>
            <th className="font-semibold pb-1 px-2">Today</th>
            <th className="font-semibold pb-1 px-2">7 days</th>
            <th className="font-semibold pb-1 px-2">30 days</th>
            <th className="font-semibold pb-1 pl-2">All time</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.code} className="border-t border-gray-100 text-right align-top">
              <td className="text-left py-2">
                {editing === r.code ? (
                  <form onSubmit={(e) => { e.preventDefault(); saveRename(r.code); }} className="flex gap-2 items-center">
                    <input className={`${inputClass} uppercase w-40`} value={rename} autoFocus maxLength={20}
                      onChange={(e) => setRename(clean(e.target.value))} aria-label={`New name for ${r.code}`} />
                    <button className="btn-sun px-3 py-1.5 text-xs" disabled={busy}>Save</button>
                    <button type="button" onClick={() => setEditing(null)} className="text-xs text-gray-500">Cancel</button>
                  </form>
                ) : (
                  <>
                    <span className="font-bold tracking-wide">{r.code}</span>
                    {!r.house && <span className="ml-2 text-xs text-gray-500">@{r.owner}</span>}
                    <span className="block text-xs">
                      <button onClick={() => copy(r.code)} className="text-blue-600 font-medium">Copy link</button>
                      {r.house && <>
                        <button onClick={() => { setEditing(r.code); setRename(r.code); setMsg(null); }} className="text-blue-600 font-medium ml-3">Rename</button>
                        <button onClick={() => remove(r)} className="text-gray-400 hover:text-red-600 ml-3">Delete</button>
                      </>}
                    </span>
                  </>
                )}
              </td>
              <td className="px-2 py-2 font-semibold">{r.d1}</td>
              <td className="px-2 py-2 font-semibold">{r.d7}</td>
              <td className="px-2 py-2 font-semibold">{r.d30}</td>
              <td className="pl-2 py-2 font-semibold">{r.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-5">
      <section className="card p-4" aria-label="House codes">
        <h2 className="text-lg font-semibold">House codes</h2>
        <p className="text-xs text-gray-500 mt-1">Codes that belong to POVGo, not to a creator. Everyone needs a code to join, so keep at least one active.</p>
        <form onSubmit={add} className="flex gap-2 mt-3">
          <input id="house-new" className={`${inputClass} flex-1 uppercase`} value={draft} maxLength={20}
            onChange={(e) => setDraft(clean(e.target.value))} placeholder="Add a house code, like LAUNCH"
            autoCapitalize="characters" autoCorrect="off" aria-label="New house code" />
          <button className="btn-sun px-4 text-sm" disabled={busy || !draft.trim()}>Add</button>
        </form>
        {msg && <p className={`text-xs mt-2 ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
        <div className="mt-3">
          {loaded && house.length === 0
            ? <p className="text-sm text-gray-500">No house codes. Add one above so new people can join.</p>
            : table(house)}
        </div>
      </section>

      <section className="card p-4" aria-label="Creator codes">
        <h2 className="text-lg font-semibold">Creator codes</h2>
        <p className="text-xs text-gray-500 mt-1">Each creator makes up to 3 of their own on My Spots. You can see them here but not change them.</p>
        <div className="mt-3">
          {loaded && creators.length === 0
            ? <p className="text-sm text-gray-500">No creator codes yet.</p>
            : table(creators)}
        </div>
      </section>
    </div>
  );
}
