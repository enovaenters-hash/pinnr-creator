'use client';

import { useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { inputClass } from '@/components/AuthCard';
import { scrimFor } from '@/lib/business';

export type Tone = 'light' | 'dark';
type Option = { src: string; tone: Tone } | { error: string } | null;

/** Average brightness of the image decides whether the page uses dark text (light image) or light text (dark image). */
export function toneOf(src: string): Promise<Tone> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 24; c.height = 36;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0, 24, 36);
        const d = ctx.getImageData(0, 0, 24, 36).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
        resolve(sum / (d.length / 4) < 0.5 ? 'dark' : 'light');
      } catch { resolve('light'); }
    };
    img.onerror = () => resolve('light');
    img.src = src;
  });
}

/** Shrink the reference photo so it uploads fast. */
function shrink(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 900 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

/** Mock of the page's layout (title, Top 3, map, carousel) so the admin can judge each option in place. */
function MiniPage({ src, tone }: { src: string; tone: Tone }) {
  const ink = tone === 'dark' ? 'bg-white/85' : 'bg-ink/70';
  return (
    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-frost">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${src})` }} />
      <div className="absolute inset-0" style={{ background: scrimFor(tone) }} />
      <div className="absolute inset-0 px-[10%] pt-[6%]">
        <div className={`h-[3.2%] w-[55%] rounded ${ink}`} />
        <div className={`mt-[3%] h-[1.8%] w-[85%] rounded opacity-70 ${ink}`} />
        <div className={`mt-[1.5%] h-[1.8%] w-[65%] rounded opacity-70 ${ink}`} />
        <div className="mt-[6%] grid grid-cols-3 gap-[4%]">
          {[0, 1, 2].map((i) => <div key={i} className="aspect-[3/4] rounded bg-ink/55" />)}
        </div>
        <div className="mt-[6%] h-[16%] rounded bg-ink/40" />
        <div className="mt-[6%] flex gap-[4%]">
          {[0, 1, 2].map((i) => <div key={i} className="h-[16%] aspect-[4/5] w-[30%] rounded bg-ink/55" />)}
        </div>
      </div>
    </div>
  );
}

/**
 * Admin > Business Pages > Background. Describe the look (and optionally attach a photo of the place), get four AI
 * options sized to the page's layout, preview each on a mock of the page, and use one. Text color follows the image.
 */
export default function BusinessBackground({ slug, name, bgUrl, bgTone, onUse, onClear }: {
  slug: string; name: string; bgUrl?: string; bgTone?: Tone;
  onUse: (url: string, tone: Tone) => void; onClear: () => void;
}) {
  const [desc, setDesc] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [opts, setOpts] = useState<Option[]>([null, null, null, null]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pick(f: File | undefined) {
    if (!f) return;
    try { setPhoto(await shrink(f)); setMsg(null); } catch { setMsg({ text: 'Could not read that photo.', ok: false }); }
  }

  async function generate() {
    if (desc.trim().length < 3) { setMsg({ text: 'Describe the look first, e.g. "warm Thai restaurant, temple gold and teal".', ok: false }); return; }
    const { data: { session } } = await getSupabase().auth.getSession();
    if (!session) { setMsg({ text: 'Please sign in again.', ok: false }); return; }
    setBusy(true); setMsg(null); setOpts([null, null, null, null]);
    await Promise.all([0, 1, 2, 3].map(async (variant) => {
      let result: Option;
      try {
        const res = await fetch('/api/admin/business-bg', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ description: desc, name, photo, variant }),
        });
        const j = (await res.json().catch(() => ({}))) as { image?: string; error?: string };
        result = res.ok && j.image ? { src: j.image, tone: await toneOf(j.image) } : { error: j.error ?? 'Something went wrong.' };
      } catch { result = { error: 'Network problem. Try again.' }; }
      setOpts((o) => o.map((x, i) => (i === variant ? result : x)));
    }));
    setBusy(false);
  }

  async function use(i: number) {
    const o = opts[i];
    if (!o || 'error' in o) return;
    setSaving(i); setMsg(null);
    try {
      const blob = await (await fetch(o.src)).blob();
      const sb = getSupabase();
      const path = `${slug || 'page'}/${Date.now()}.jpg`;
      const { error } = await sb.storage.from('business-backgrounds').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;
      onUse(sb.storage.from('business-backgrounds').getPublicUrl(path).data.publicUrl, o.tone);
      setMsg({ text: 'Background chosen. Press Save to publish it.', ok: true });
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setMsg({ text: /bucket|not found|policy|row-level/i.test(m) ? 'Run supabase/business-backgrounds.sql in Supabase first.' : m, ok: false });
    }
    setSaving(null);
  }

  const errors = opts.filter((o): o is { error: string } => Boolean(o && 'error' in o));

  return (
    <div className="card p-5 grid gap-3">
      <div>
        <h3 className="text-lg font-semibold">Page background</h3>
        <p className="text-sm text-gray-600">
          Describe the look and, if you have one, attach a photo of the place. You get 4 AI options made for this page&apos;s layout
          (calm behind the video tiles and map, color on the edges). Text switches light or dark by itself.
        </p>
      </div>

      {bgUrl && (
        <div className="flex items-center gap-3">
          <div className="w-16"><MiniPage src={bgUrl} tone={bgTone ?? 'light'} /></div>
          <p className="text-sm font-bold">Current background ({bgTone === 'dark' ? 'dark, light text' : 'light, dark text'})</p>
          <button type="button" onClick={onClear} className="btn-ghost px-3 py-1 text-xs ml-auto">Remove</button>
        </div>
      )}

      <label className="grid gap-1 text-sm font-bold">What should it look like?
        <textarea className={inputClass} rows={2} maxLength={500} value={desc} onChange={(e) => setDesc(e.target.value)}
          placeholder="Family Thai kitchen in Tempe: temple gold, deep teal and warm lantern light, cozy" />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost px-3 py-1.5 text-sm">{photo ? 'Change photo' : '+ Attach a photo (optional)'}</button>
        {photo && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="Reference" className="h-10 w-10 rounded object-cover" />
            <button type="button" onClick={() => setPhoto(null)} className="text-xs font-bold text-gray-500 underline">Remove photo</button>
          </>
        )}
        <button type="button" onClick={generate} disabled={busy} className="btn-sun px-5 py-2 text-sm ml-auto disabled:opacity-50">
          {busy ? 'Generating… (about 30 seconds)' : opts.some(Boolean) ? 'Generate 4 more' : 'Generate 4 options'}
        </button>
      </div>

      {(busy || opts.some(Boolean)) && (
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {opts.map((o, i) => (
            <li key={i} className="grid gap-1.5">
              {o && 'src' in o ? (
                <>
                  <MiniPage src={o.src} tone={o.tone} />
                  <button type="button" onClick={() => use(i)} disabled={saving !== null} className="btn-sun px-3 py-1.5 text-xs disabled:opacity-50">
                    {saving === i ? 'Saving…' : 'Use this one'}
                  </button>
                </>
              ) : (
                <div className={`aspect-[2/3] w-full rounded-xl ${o ? 'bg-red-50 text-red-700 text-xs font-bold p-2' : 'bg-frost animate-pulse'}`}>{o && 'error' in o ? 'Failed' : null}</div>
              )}
            </li>
          ))}
        </ul>
      )}
      {errors[0] && <p role="alert" className="text-sm font-bold text-red-700">{errors[0].error}</p>}
      {msg && <p role="status" className={`text-sm font-bold ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</p>}
    </div>
  );
}
