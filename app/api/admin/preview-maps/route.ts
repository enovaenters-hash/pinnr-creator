import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/supabase';
import { fetchLatestVideos } from '@/lib/tiktok';
import { extractLocation, geocodeCandidates, guessCategory } from '@/lib/location';
import { geocode, sleep } from '@/lib/geocode';

export const maxDuration = 60;
const LOOKUPS_PER_CALL = 12; // Nominatim allows ~1 request/second

/**
 * Admin only. Creator preview maps:
 *   build    { handle }                -> pull their latest public TikToks, keep the ones with a place, save the map
 *   geocode  { handle }                -> place addresses that came without coordinates (a few per call)
 *   place    { id, address }           -> fix one spot's address and place it
 */
export async function POST(request: Request) {
  const auth = await getRequestUser(request);
  if (!auth) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  const { supabase } = auth;
  const { data: admin } = await supabase.from('admins').select('user_id').eq('user_id', auth.user.id).maybeSingle();
  if (!admin) return NextResponse.json({ error: 'Admins only.' }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { action?: string; handle?: string; id?: string; address?: string };
  const handle = (body.handle ?? '').replace(/^@/, '').trim().toLowerCase();
  const needsSql = (m: string) => /preview_(maps|spots)|relation|schema cache/i.test(m)
    ? 'Run supabase/preview-maps.sql in Supabase first.' : m;

  if (body.action === 'build') {
    if (!/^[a-z0-9._]{2,40}$/.test(handle)) return NextResponse.json({ error: `“${body.handle}” isn't a TikTok @username.` }, { status: 400 });
    let latest;
    try { latest = await fetchLatestVideos(handle, 35); }
    catch (e) { return NextResponse.json({ error: `@${handle}: ${(e as Error).message}` }, { status: 502 }); }
    if (!latest.length) return NextResponse.json({ error: `@${handle}: no public videos found.` }, { status: 404 });

    const first = latest[0];
    const { error: mapErr } = await supabase.from('preview_maps').upsert({
      handle, display_name: first.authorNickname, avatar_url: first.authorAvatar, updated_at: new Date().toISOString(),
    });
    if (mapErr) return NextResponse.json({ error: needsSql(mapErr.message) }, { status: 500 });

    // Only videos that name a place: a TikTok location tag, or an address in the caption.
    const rows = latest.map((v) => {
      const loc = extractLocation(v.caption);
      const poi = v.poi;
      const placed = poi !== null && poi.lat !== null && poi.lng !== null;
      const address = poi?.address ?? loc?.address ?? null;
      if (!placed && !address) return null;
      return {
        handle, tiktok_id: v.tiktokId, caption: v.caption, cover_url: v.coverUrl, video_url: v.videoUrl, posted_at: v.postedAt,
        place_name: poi?.name || loc?.placeName || null, address,
        lat: placed ? poi!.lat : null, lng: placed ? poi!.lng : null, geocode_attempted: placed,
        category: guessCategory(`${v.caption} ${poi?.name ?? loc?.placeName ?? ''} ${poi?.kind ?? ''}`),
      };
    }).filter((r): r is NonNullable<typeof r> => r !== null);
    if (rows.length) {
      const { error } = await supabase.from('preview_spots').upsert(rows, { onConflict: 'handle,tiktok_id', ignoreDuplicates: true });
      if (error) return NextResponse.json({ error: needsSql(error.message) }, { status: 500 });
      // TikTok cover links expire: refresh them on every build.
      for (const v of latest) {
        if (v.coverUrl) await supabase.from('preview_spots').update({ cover_url: v.coverUrl }).eq('handle', handle).eq('tiktok_id', v.tiktokId);
      }
    }
    const placed = await placePending(supabase, handle);
    return NextResponse.json({ handle, checked: latest.length, spots: rows.length, ...placed });
  }

  if (body.action === 'geocode') {
    if (!handle) return NextResponse.json({ error: 'Which map?' }, { status: 400 });
    return NextResponse.json(await placePending(supabase, handle));
  }

  if (body.action === 'place') {
    const address = (body.address ?? '').trim().slice(0, 200);
    if (!body.id || address.length < 4) return NextResponse.json({ error: 'Type an address first.' }, { status: 400 });
    let hit = null;
    for (const q of geocodeCandidates(address)) { hit = await geocode(q); if (hit) break; await sleep(1100); }
    const { error } = await supabase.from('preview_spots')
      .update({ address, lat: hit?.lat ?? null, lng: hit?.lng ?? null, geocode_attempted: true }).eq('id', body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!hit) return NextResponse.json({ error: "Couldn't find that address on the map. Try adding the city and state." }, { status: 404 });
    return NextResponse.json({ lat: hit.lat, lng: hit.lng });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}

/** Geocode a few of this map's spots that have an address but no coordinates yet. */
async function placePending(supabase: NonNullable<Awaited<ReturnType<typeof getRequestUser>>>['supabase'], handle: string) {
  const { data } = await supabase.from('preview_spots').select('id, address, place_name')
    .eq('handle', handle).is('lat', null).eq('geocode_attempted', false).not('address', 'is', null).limit(LOOKUPS_PER_CALL);
  let mapped = 0;
  let lookups = 0;
  for (const s of data ?? []) {
    let hit = null;
    for (const q of geocodeCandidates(s.address as string, s.place_name as string | null)) {
      if (lookups >= LOOKUPS_PER_CALL) break;
      if (lookups) await sleep(1100);
      lookups++;
      hit = await geocode(q);
      if (hit) break;
    }
    if (lookups >= LOOKUPS_PER_CALL && !hit) break;
    await supabase.from('preview_spots').update({ lat: hit?.lat ?? null, lng: hit?.lng ?? null, geocode_attempted: true }).eq('id', s.id);
    if (hit) mapped++;
  }
  const { count } = await supabase.from('preview_spots').select('id', { count: 'exact', head: true })
    .eq('handle', handle).is('lat', null).eq('geocode_attempted', false).not('address', 'is', null);
  return { mapped, pending: count ?? 0 };
}
