'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { inputClass } from '@/components/AuthCard';

type Code = { id: string; code: string };
type Stat = { code: string | null; total: number; d1: number; d7: number; d30: number };

const MAX_CODES = 3;

/**
 * "Your referral codes" on My Spots. A creator types up to 3 of their own codes (letters and numbers),
 * shares the link, and sees how many people signed up with each code in the last 1 / 7 / 30 days.
 * Needs supabase/referrals.sql; until it has been run this shows a short note instead.
 */
export default function ReferralPanel({ creatorId }: { creatorId: string }) {
  const [codes, setCodes] = useState<Code[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [ready, setReady] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const [c, s] = await Promise.all([
      supabase.from('referral_codes').select('id, code').eq('creator_id', creatorId).order('created_at'),
      supabase.rpc('referral_stats'),
    ]);
    if (c.error) { setReady(false); setLoaded(true); return; }
    setCodes((c.data ?? []) as Code[]);
    setStats(((s.data ?? []) as Record<string, unknown>[]).map((r) => ({
      code: (r.code as string | null) ?? null,
      total: Number(r.total) || 0, d1: Number(r.d1) || 0, d7: Number(r.d7) || 0, d30: Number(r.d30) || 0,
    })));
    setLoaded(true);
  }, [creatorId]);

  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const code = draft.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,20}$/.test(code)) { setMsg({ text: 'Use 3 to 20 letters or numbers, no spaces.', ok: false }); return; }
    setBusy(true); setMsg(null);
    const { error } = await getSupabase().from('referral_codes').insert({ creator_id: creatorId, code });
    setBusy(false);
    if (error) {
      setMsg({
        text: error.code === '23505' ? `${code} is already taken. Try another.`
          : /up to 3/i.test(error.message) ? `You can have up to ${MAX_CODES} codes.`
          : 'Couldn’t save that code. Try again.',
        ok: false,
      });
      return;
    }
    setDraft(''); setMsg({ text: `${code} is ready to share`, ok: true });
    load();
  }

  async function remove(c: Code) {
    if (!window.confirm(`Delete ${c.code}? People can't sign up with it any more. Your past signup counts stay.`)) return;
    const { error } = await getSupabase().from('referral_codes').delete().eq('id', c.id);
    if (error) { setMsg({ text: 'Couldn’t delete that code. Try again.', ok: false }); return; }
    setMsg({ text: `${c.code} deleted`, ok: true });
    load();
  }

  async function copy(code: string) {
    const link = `${window.location.origin}/signup?ref=${code}`;
    try { await navigator.clipboard.writeText(link); setMsg({ text: 'Signup link copied. The code is filled in for them.', ok: true }); }
    catch { setMsg({ text: link, ok: true }); }
  }

  if (loaded && !ready) {
    return (
      <section className="card p-4 mb-6">
        <h2 className="text-lg font-semibold">Your referral codes</h2>
        <p className="text-sm text-gray-500 mt-1">Referral codes aren’t switched on yet. The site owner needs to run <code>supabase/referrals.sql</code> once.</p>
      </section>
    );
  }

  const statFor = (code: string | null) => stats.find((s) => s.code === code);
  const removed = statFor(null);
  // House codes (like POVGO) only come back for admins; they aren't the creator's own codes.
  const house = stats.filter((x) => x.code && !codes.some((c) => c.code === x.code));
  const sum = (k: 'd1' | 'd7' | 'd30' | 'total') => stats.reduce((n, s) => n + s[k], 0);

  return (
    <section className="card p-4 mb-6" aria-label="Referral codes">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Your referral codes</h2>
        <span className="text-xs text-gray-500">{codes.length}/{MAX_CODES} used</span>
      </div>
      <p className="text-xs text-gray-500 mt-1">Everyone needs a code to join POVGo. Share yours and see who signs up.</p>

      {codes.length < MAX_CODES && (
        <form onSubmit={add} className="flex gap-2 mt-3">
          <input id="referral-new" className={`${inputClass} flex-1 uppercase`} value={draft} maxLength={20}
            onChange={(e) => setDraft(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
            placeholder="Type a code, like SAMSPOV" autoCapitalize="characters" autoCorrect="off" aria-label="New referral code" />
          <button className="btn-sun px-4 text-sm" disabled={busy || !draft.trim()}>{busy ? 'Saving…' : 'Add'}</button>
        </form>
      )}
      {msg && <p className={`text-xs mt-2 ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}

      {(codes.length > 0 || house.length > 0) && (
        <div className="mt-3 overflow-x-auto">
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
              {codes.map((c) => {
                const s = statFor(c.code);
                return (
                  <tr key={c.id} className="border-t border-gray-100 text-right">
                    <td className="text-left py-2">
                      <span className="font-bold tracking-wide">{c.code}</span>
                      <span className="block text-xs">
                        <button onClick={() => copy(c.code)} className="text-blue-600 font-medium">Copy link</button>
                        <button onClick={() => remove(c)} className="text-gray-400 hover:text-red-600 ml-3">Delete</button>
                      </span>
                    </td>
                    <td className="px-2 font-semibold">{s?.d1 ?? 0}</td>
                    <td className="px-2 font-semibold">{s?.d7 ?? 0}</td>
                    <td className="px-2 font-semibold">{s?.d30 ?? 0}</td>
                    <td className="pl-2 font-semibold">{s?.total ?? 0}</td>
                  </tr>
                );
              })}
              {house.map((h) => (
                <tr key={h.code} className="border-t border-gray-100 text-right">
                  <td className="text-left py-2"><span className="font-bold tracking-wide">{h.code}</span>
                    <span className="block text-xs text-gray-500">House code</span></td>
                  <td className="px-2 font-semibold">{h.d1}</td><td className="px-2 font-semibold">{h.d7}</td>
                  <td className="px-2 font-semibold">{h.d30}</td><td className="pl-2 font-semibold">{h.total}</td>
                </tr>
              ))}
              {removed && (
                <tr className="border-t border-gray-100 text-right text-gray-500">
                  <td className="text-left py-2 text-xs">Deleted codes</td>
                  <td className="px-2">{removed.d1}</td><td className="px-2">{removed.d7}</td>
                  <td className="px-2">{removed.d30}</td><td className="pl-2">{removed.total}</td>
                </tr>
              )}
              {codes.length > 1 && (
                <tr className="border-t-2 border-gray-200 text-right font-bold">
                  <td className="text-left py-2">Total</td>
                  <td className="px-2">{sum('d1')}</td><td className="px-2">{sum('d7')}</td>
                  <td className="px-2">{sum('d30')}</td><td className="pl-2">{sum('total')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {loaded && codes.length === 0 && house.length === 0 && (
        <p className="text-sm text-gray-500 mt-3">You don’t have a code yet. Type one above to get started.</p>
      )}
    </section>
  );
}
