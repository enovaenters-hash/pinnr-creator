'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase, supabaseConfigured } from '@/lib/supabase';

export type Promo = {
  enabled: boolean; title: string; body: string; button_label: string; button_url: string;
  after_plays: number; repeat_days: number; updated_at: string;
};

const KEY = 'povgo_promo_v1';
type Mem = { plays: number; seenAt: number | null; seenVer: string | null };

const read = (): Mem => {
  try { const m = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (m && typeof m.plays === 'number') return m as Mem; } catch { /* private mode */ }
  return { plays: 0, seenAt: null, seenVer: null };
};
const write = (m: Mem) => { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* private mode */ } };

/** Only web links or on-site paths: nothing a stray field could turn into script. */
const safeHref = (u: string) => (/^https:\/\//i.test(u) || /^\/(?!\/)/.test(u) ? u : null);

/**
 * The promo pop-up the admin sets (Admin > Promo). It counts videos the visitor starts playing, in their own
 * browser, and shows once they have played `after_plays`; then at most every `repeat_days` days (0 = only once).
 * The admin's Preview button fires `povgo:promo-preview` to show it straight away.
 */
export default function PromoPopup() {
  const [promo, setPromo] = useState<Promo | null>(null);
  const cache = useRef<Promo | null | undefined>(undefined);
  const lastPlay = useRef<{ id: string; at: number } | null>(null);

  const close = useCallback(() => setPromo(null), []);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const load = async (): Promise<Promo | null> => {
      if (cache.current !== undefined) return cache.current;
      const { data, error } = await getSupabase().from('site_promo').select('*').eq('id', 1).maybeSingle();
      cache.current = error || !data ? null : (data as Promo);
      return cache.current;
    };

    const onPlay = async (e: Event) => {
      const id = String((e as CustomEvent<{ id?: string }>).detail?.id ?? '');
      const now = Date.now();
      // The same video starting twice in a row (re-render, next clip) counts once.
      if (id && lastPlay.current && lastPlay.current.id === id && now - lastPlay.current.at < 60_000) return;
      lastPlay.current = { id, at: now };

      const mem = read();
      mem.plays += 1;
      write(mem);

      const p = await load();
      if (!p || !p.enabled || !p.title.trim() || mem.plays < p.after_plays) return;
      const seenThis = mem.seenVer === p.updated_at && mem.seenAt !== null;
      const waited = mem.seenAt !== null && now - mem.seenAt >= p.repeat_days * 86_400_000;
      // A newly edited promo shows again; an unchanged one waits out the repeat time (0 days = never again).
      if (seenThis && (p.repeat_days === 0 || !waited)) return;
      write({ plays: 0, seenAt: now, seenVer: p.updated_at });
      setPromo(p);
    };

    const onPreview = (e: Event) => setPromo((e as CustomEvent<Promo>).detail ?? null);

    window.addEventListener('povgo:play', onPlay);
    window.addEventListener('povgo:promo-preview', onPreview);
    return () => { window.removeEventListener('povgo:play', onPlay); window.removeEventListener('povgo:promo-preview', onPreview); };
  }, []);

  useEffect(() => {
    if (!promo) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [promo, close]);

  if (!promo) return null;
  const href = safeHref(promo.button_url.trim());

  return (
    <div className="fixed inset-0 z-[1500] flex items-end sm:items-center justify-center bg-ink/55 p-3" onClick={close}>
      <div role="dialog" aria-modal="true" aria-label={promo.title} onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
        <button type="button" onClick={close} aria-label="Close" className="absolute right-3 top-3 w-8 h-8 rounded-full bg-cloud text-ink font-extrabold">×</button>
        <h2 className="font-display text-2xl font-semibold text-ink pr-6 pl-6">{promo.title}</h2>
        {promo.body && <p className="mt-2 text-sm font-bold text-gray-600 whitespace-pre-line">{promo.body}</p>}
        {href && promo.button_label.trim() && (
          <a href={href} onClick={close} {...(href.startsWith('/') ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
            className="btn-sun mt-5 inline-block px-6 py-3 text-base">{promo.button_label}</a>
        )}
        <button type="button" onClick={close} className="block mx-auto mt-3 text-xs font-extrabold text-gray-500 underline">Not now</button>
      </div>
    </div>
  );
}
