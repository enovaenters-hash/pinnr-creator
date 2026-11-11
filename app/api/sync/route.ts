import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/supabase';
import { fetchLatestVideos, extractLocation, guessCategory, geocodeCandidates } from '@/lib/tiktok';
import { geocode, sleep, type GeoResult } from '@/lib/geocode';

export const maxDuration = 60;

// Nominatim allows ~1 request/second, so cap lookups per sync. Anything left over
// is picked up automatically on the next sync.
const MAX_LOOKUPS = 15;

/**
 * Sync: pull the creator's latest 20 TikToks, insert only new ones, refresh cover
 * images (TikTok's image links expire), and place pending addresses on the map.
 */
export async function POST(request: Request) {
  const auth = await getRequestUser(request);
  if (!auth) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  const { user, supabase } = auth;

  const { data: creator } = await supabase
    .from('creators').select('id, tiktok_username').eq('id', user.id).single();
  if (!creator) return NextResponse.json({ error: 'Creator profile not found.' }, { status: 404 });

  let latest;
  try {
    latest = await fetchLatestVideos(creator.tiktok_username, 20);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  const { data: existing } = await supabase
    .from('videos').select('id, tiktok_id').eq('creator_id', creator.id);
  const seen = new Map((existing ?? []).map((r) => [r.tiktok_id as string, r.id as string]));

  // 1) Insert only videos we haven't stored yet.
  const fresh = latest.filter((v) => !seen.has(v.tiktokId));
  if (fresh.length) {
    const rows = fresh.map((v) => {
      const loc = extractLocation(v.caption);
      return {
        creator_id: creator.id,
        tiktok_id: v.tiktokId,
        caption: v.caption,
        cover_url: v.coverUrl,
        video_url: v.videoUrl,
        posted_at: v.postedAt,
        place_name: loc?.placeName || null,
        address: loc?.address ?? null,
        category: guessCategory(v.caption),
      };
    });
    const { error } = await supabase
      .from('videos').upsert(rows, { onConflict: 'creator_id,tiktok_id', ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 2) Refresh cover images on videos we already had.
  await Promise.all(latest.filter((v) => seen.has(v.tiktokId) && v.coverUrl).map((v) =>
    supabase.from('videos').update({ cover_url: v.coverUrl }).eq('id', seen.get(v.tiktokId)!)));

  // 3) Geocode anything with an address that hasn't been tried yet.
  const { data: pending } = await supabase
    .from('videos').select('id, address, place_name')
    .eq('creator_id', creator.id).is('lat', null).not('address', 'is', null).eq('geocode_attempted', false)
    .order('posted_at', { ascending: false });

  let lookups = 0;
  let mapped = 0;
  let processed = 0;
  for (const v of pending ?? []) {
    if (lookups >= MAX_LOOKUPS) break;
    let hit: GeoResult | null = null;
    let triedAll = true;
    for (const q of geocodeCandidates(v.address!, v.place_name)) {
      if (lookups >= MAX_LOOKUPS) { triedAll = false; break; }
      if (lookups > 0) await sleep(1100);
      lookups++;
      hit = await geocode(q);
      if (hit) break;
    }
    if (!hit && !triedAll) break; // ran out of lookups mid-way; retry next sync
    await supabase.from('videos').update({
      lat: hit?.lat ?? null, lng: hit?.lng ?? null, geocode_attempted: true,
    }).eq('id', v.id);
    processed++;
    if (hit) mapped++;
  }

  await supabase.from('creators').update({ last_synced_at: new Date().toISOString() }).eq('id', creator.id);

  return NextResponse.json({
    checked: latest.length,
    added: fresh.length,
    mapped,
    pending: (pending?.length ?? 0) - processed, // still to locate on the next sync
  });
}
