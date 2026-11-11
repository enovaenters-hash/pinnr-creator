import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/supabase';
import { geocode, sleep, type GeoResult } from '@/lib/geocode';
import { geocodeCandidates } from '@/lib/tiktok';
import { CATEGORIES } from '@/lib/types';

const MAX_FEATURED = 3;

type Patch = {
  place_name?: string | null;
  category?: string | null;
  address?: string | null;
  discount_code?: string | null;
  featured?: boolean;
  hidden?: boolean;
};

const clean = (s: unknown, max = 200) =>
  typeof s === 'string' ? (s.trim().slice(0, max) || null) : null;

/** Edit a video's place name, category, address, discount code, featured/hidden flags. */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getRequestUser(request);
  if (!auth) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  const { user, supabase } = auth;
  const { id } = await ctx.params;

  const { data: current } = await supabase
    .from('videos').select('*').eq('id', id).eq('creator_id', user.id).single();
  if (!current) return NextResponse.json({ error: 'Video not found.' }, { status: 404 });

  const body = (await request.json()) as Patch;
  const update: Record<string, unknown> = {};
  let warning: string | null = null;

  if ('place_name' in body) update.place_name = clean(body.place_name, 120);
  if ('discount_code' in body) update.discount_code = clean(body.discount_code, 40);
  if ('hidden' in body) update.hidden = Boolean(body.hidden);
  if ('category' in body) {
    const c = clean(body.category, 40)?.toLowerCase() ?? null;
    update.category = c && (CATEGORIES as readonly string[]).includes(c) ? c : null;
  }

  if ('address' in body) {
    const address = clean(body.address, 300);
    update.address = address;
    if (address !== current.address || current.lat === null) {
      if (address) {
        let hit: GeoResult | null = null;
        const placeName = 'place_name' in body ? (update.place_name as string | null) : current.place_name;
        for (const [i, q] of geocodeCandidates(address, placeName).entries()) {
          if (i > 0) await sleep(1100);
          hit = await geocode(q);
          if (hit) break;
        }
        update.lat = hit?.lat ?? null;
        update.lng = hit?.lng ?? null;
        update.geocode_attempted = true;
        if (!hit) warning = "Couldn't find that address on the map. Try adding the city and state.";
      } else {
        update.lat = null;
        update.lng = null;
        update.geocode_attempted = false;
      }
    }
  }

  if ('featured' in body) {
    const want = Boolean(body.featured);
    if (want && !current.featured) {
      const { count } = await supabase
        .from('videos').select('id', { count: 'exact', head: true })
        .eq('creator_id', user.id).eq('featured', true);
      if ((count ?? 0) >= MAX_FEATURED) {
        return NextResponse.json(
          { error: `You can feature up to ${MAX_FEATURED} videos. Unstar one first.` },
          { status: 400 },
        );
      }
    }
    update.featured = want;
  }

  const { data, error } = await supabase
    .from('videos').update(update).eq('id', id).eq('creator_id', user.id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ video: data, warning });
}
