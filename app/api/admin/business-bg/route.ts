import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/supabase';

export const maxDuration = 60;

const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const QUALITY = process.env.OPENAI_IMAGE_QUALITY || 'low'; // backgrounds are soft anyway; low is fast and cheap
const MAX_PHOTO = 2_000_000; // characters of base64, ~1.5 MB

/** Four looks, so one "Generate" gives real choices. */
const STYLES = [
  'Soft painterly watercolor washes with gentle color blends.',
  'Out-of-focus atmospheric photograph of the place: warm bokeh, shallow depth of field, nothing sharp.',
  'Modern flat illustration: a restrained palette, simple shapes and a repeating motif drawn from the description.',
  'Smooth textured gradient (paper, linen or plaster grain) with a few small motifs from the description.',
];

/** Tells the model where the page's content sits, so the interest goes where nothing covers it. */
const LAYOUT = [
  'Make a portrait 2:3 background image for a phone web page.',
  'Layout: the top 20% sits behind a business name and short text, so keep it calm.',
  'The centre column (about 70% of the width) is covered by three tall video tiles, a map and rows of video cards, so keep the centre low-contrast, evenly lit and soft, with no focal point or fine detail.',
  'Put the visual interest (shapes, color, texture, motifs from the description) along the left and right edges and in the corners, fading out toward the middle.',
  'Absolutely no text, letters, numbers, logos, people, faces or user-interface elements.',
].join(' ');

/**
 * Admin only: one AI background option for a business page.
 *   POST { description, name?, photo? (data URL), variant 0-3 }  ->  { image: data URL }
 * The browser asks for four variants in parallel. Needs OPENAI_API_KEY in Vercel.
 */
export async function POST(request: Request) {
  const auth = await getRequestUser(request);
  if (!auth) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  const { data: admin } = await auth.supabase.from('admins').select('user_id').eq('user_id', auth.user.id).maybeSingle();
  if (!admin) return NextResponse.json({ error: 'Admins only.' }, { status: 403 });

  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: 'OPENAI_API_KEY is not set in Vercel yet.' }, { status: 500 });

  const body = (await request.json().catch(() => ({}))) as { description?: string; name?: string; photo?: string; variant?: number };
  const description = (body.description ?? '').trim().slice(0, 500);
  if (description.length < 3) return NextResponse.json({ error: 'Describe the look you want first.' }, { status: 400 });
  const variant = Math.min(3, Math.max(0, Math.floor(Number(body.variant) || 0)));
  const photo = typeof body.photo === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(body.photo) ? body.photo : null;
  if (photo && photo.length > MAX_PHOTO) return NextResponse.json({ error: 'That photo is too large. Try a smaller one.' }, { status: 413 });

  const prompt = [
    LAYOUT,
    `Business: ${(body.name ?? '').trim().slice(0, 80) || 'a local spot'}. Look wanted: ${description}`,
    `Style: ${STYLES[variant]}`,
    photo ? 'A photo of the place is attached: borrow its colors, mood and materials, but do NOT copy the photo; turn it into an abstract background.' : '',
  ].filter(Boolean).join('\n');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55_000);
  try {
    let res: Response;
    if (photo) {
      const [meta, b64] = photo.split(',');
      const mime = meta.slice(5, meta.indexOf(';'));
      const bytes = Buffer.from(b64, 'base64');
      const form = new FormData();
      form.append('model', MODEL);
      form.append('prompt', prompt);
      form.append('size', '1024x1536');
      form.append('quality', QUALITY);
      form.append('output_format', 'jpeg');
      form.append('image', new Blob([bytes], { type: mime }), `photo.${mime.split('/')[1]}`);
      res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: ctrl.signal });
    } else {
      res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, prompt, size: '1024x1536', quality: QUALITY, output_format: 'jpeg', n: 1 }),
        signal: ctrl.signal,
      });
    }
    const json = (await res.json().catch(() => ({}))) as { data?: { b64_json?: string }[]; error?: { message?: string } };
    if (!res.ok) {
      const m = json.error?.message ?? `OpenAI returned ${res.status}`;
      const hint = /verif/i.test(m) ? ' Your OpenAI organization needs to be verified for this image model (Settings > Organization > General).'
        : /billing|quota|credit/i.test(m) ? ' Add credit under Billing on platform.openai.com.' : '';
      return NextResponse.json({ error: `${m.slice(0, 220)}${hint}` }, { status: 502 });
    }
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) return NextResponse.json({ error: 'OpenAI sent no image. Try again.' }, { status: 502 });
    return NextResponse.json({ image: `data:image/jpeg;base64,${b64}` });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === 'AbortError';
    return NextResponse.json({ error: timedOut ? 'That took too long. Try again.' : 'Could not reach OpenAI.' }, { status: 504 });
  } finally {
    clearTimeout(timer);
  }
}
