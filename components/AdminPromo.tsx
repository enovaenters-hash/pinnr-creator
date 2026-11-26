'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { inputClass, Switch } from '@/components/AuthCard';
import type { Promo } from '@/components/PromoPopup';

const BLANK: Promo = { enabled: false, title: '', body: '', button_label: '', button_url: '', after_plays: 3, repeat_days: 7, updated_at: '' };
const REPEATS: [number, string][] = [[0, 'Only once per visitor'], [1, 'Every day'], [3, 'Every 3 days'], [7, 'Every week'], [14, 'Every 2 weeks'], [30, 'Every month']];

/**
 * Admin > Promo: one pop-up for the whole app. It appears after a visitor has played N videos (counted in their own
 * browser). Needs supabase/promo.sql; until it has been run this shows a short note.
 */
export default function AdminPromo() {
  const [p, setP] = useState<Promo>(BLANK);
  const [ready, setReady] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await getSupabase().from('site_promo').select('*').eq('id', 1).maybeSingle();
    if (error) { setReady(false); return; }
    setReady(true);
    if (data) setP(data as Promo);
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof Promo>(k: K, v: Promo[K]) => setP((x) => ({ ...x, [k]: v }));
  const urlOk = !p.button_url.trim() || /^https:\/\//i.test(p.button_url.trim()) || /^\/(?!\/)/.test(p.button_url.trim());

  async function save() {
    if (!urlOk) { setMsg({ text: 'The button link must start with https:// (or / for a page on POVGo).', ok: false }); return; }
    setBusy(true); setMsg(null);
    const row = {
      id: 1, enabled: p.enabled, title: p.title.trim().slice(0, 80), body: p.body.trim().slice(0, 300),
      button_label: p.button_label.trim().slice(0, 30), button_url: p.button_url.trim().slice(0, 500),
      after_plays: Math.min(100, Math.max(1, Math.round(p.after_plays) || 3)), repeat_days: p.repeat_days,
      updated_at: new Date().toISOString(),
    };
    const { error } = await getSupabase().from('site_promo').upsert(row);
    setBusy(false);
    if (error) { setMsg({ text: /site_promo|relation|schema cache/i.test(error.message) ? 'Run supabase/promo.sql in Supabase first.' : error.message, ok: false }); return; }
    setP(row);
    setMsg({ text: row.enabled ? 'Saved. The pop-up is on.' : 'Saved. The pop-up is off.', ok: true });
  }

  const preview = () => window.dispatchEvent(new CustomEvent('povgo:promo-preview', { detail: { ...p, enabled: true } }));

  return (
    <section className="card p-5 max-w-xl">
      <h2 className="text-xl font-semibold">Promo pop-up</h2>
      <p className="text-sm text-gray-600 mt-1">
        Shows one pop-up to everyone after they have played a set number of videos. Each person&apos;s plays are counted in their own browser.
        Saving changes makes it show again to people who already saw the old one.
      </p>

      {!ready && <p className="mt-3 text-sm text-amber-700">Promos aren&apos;t switched on yet. Run <code>supabase/promo.sql</code> in Supabase, then refresh.</p>}

      <div className="mt-4 grid gap-3">
        <Switch id="promo-on" on={p.enabled} onChange={(v) => set('enabled', v)} label="Pop-up is on" hint="Turn off to stop showing it without losing your text." />

        <label className="grid gap-1 text-sm font-bold">Title
          <input className={inputClass} value={p.title} maxLength={80} onChange={(e) => set('title', e.target.value)} placeholder="Own a spot? Join POVGo" />
        </label>
        <label className="grid gap-1 text-sm font-bold">Message (optional)
          <textarea className={inputClass} rows={3} value={p.body} maxLength={300} onChange={(e) => set('body', e.target.value)}
            placeholder="Map every place you post about and let fans find you." />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm font-bold">Button text
            <input className={inputClass} value={p.button_label} maxLength={30} onChange={(e) => set('button_label', e.target.value)} placeholder="Join now" />
          </label>
          <label className="grid gap-1 text-sm font-bold">Button link
            <input className={inputClass} value={p.button_url} onChange={(e) => set('button_url', e.target.value)} placeholder="https://… or /signup?as=creator" inputMode="url" autoCapitalize="none" />
          </label>
        </div>
        {!urlOk && <p className="text-xs font-bold text-red-700">The link must start with https:// (or / for a page on POVGo).</p>}

        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm font-bold">Show after this many plays
            <input className={inputClass} type="number" min={1} max={100} value={p.after_plays}
              onChange={(e) => set('after_plays', Number(e.target.value))} />
          </label>
          <label className="grid gap-1 text-sm font-bold">Show again
            <select className={inputClass} value={p.repeat_days} onChange={(e) => set('repeat_days', Number(e.target.value))}>
              {REPEATS.map(([d, label]) => <option key={d} value={d}>{label}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={busy || !ready} className="btn-sun px-5 py-2 text-sm disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={preview} disabled={!p.title.trim()} className="btn-ghost px-4 py-2 text-sm disabled:opacity-50">Preview</button>
        {msg && <span role="status" className={`text-sm font-bold ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</span>}
      </div>
    </section>
  );
}
