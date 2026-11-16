import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/supabase';
import { fetchLatestVideos, extractLocation, guessCategory, geocodeCandidates, looksLikeSentence } from '@/lib/tiktok';
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
    .from('creators').select('id, tiktok_username, display_name').eq('id', user.id).single();
  if (!creator) return NextResponse.json({ error: 'Creator profile not found.' }, { status: 404 });

  let latest;
  try {
    latest = await fetchLatestVideos(creator.tiktok_username, 20);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  const { data: existing } = await supabase
    .from('videos').select('id, tiktok_id, lat, place_name, address').eq('creator_id', creator.id);
  const seen = new Map((existing ?? []).map((r) => [r.tiktok_id as string, r.id as string]));
  const existingByTid = new Map((existing ?? []).map((r) => [r.tiktok_id as string, r]));

  // 1) Insert only videos we haven't stored yet. A TikTok location tag (name, address and
  //    coordinates, straight from TikTok) beats guessing from the caption, and needs no geocoding.
  const fresh = latest.filter((v) => !seen.has(v.tiktokId));
  let tagged = 0;
  if (fresh.length) {
    const rows = fresh.map((v) => {
      const loc = extractLocation(v.caption);
      const poi = v.poi;
      const placed = poi !== null && poi.lat !== null && poi.lng !== null;
      if (placed) tagged++;
      return {
        creator_id: creator.id,
        tiktok_id: v.tiktokId,
        caption: v.caption,
        cover_url: v.coverUrl,
        video_url: v.videoUrl,
        posted_at: v.postedAt,
        place_name: poi?.name || loc?.placeName || null,
        address: poi?.address ?? loc?.address ?? null,
        lat: placed ? poi.lat : null,
        lng: placed ? poi.lng : null,
        geocode_attempted: placed,
        category: guessCategory(`${v.caption} ${poi?.name ?? loc?.placeName ?? ''} ${poi?.kind ?? ''}`),
      };
    });
    const { error } = await supabase
      .from('videos').upsert(rows, { onConflict: 'creator_id,tiktok_id', ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 2) Refresh cover images on videos we already had.
  await Promise.all(latest.filter((v) => seen.has(v.tiktokId) && v.coverUrl).map((v) =>
    supabase.from('videos').update({ cover_url: v.coverUrl }).eq('id', seen.get(v.tiktokId)!)));

  // 2b) Videos stored before location tags were read: if one has no pin yet but carries a
  //     tag, place it now. Videos that already have a pin (including creator edits) are left alone.
  await Promise.all(latest.map(async (v) => {
    const row = existingByTid.get(v.tiktokId);
    const poi = v.poi;
    if (!row || !poi || poi.lat === null || poi.lng === null || row.lat !== null) return;
    const keepName = row.place_name && !looksLikeSentence(row.place_name);
    const { error } = await supabase.from('videos').update({
      place_name: keepName ? row.place_name : poi.name,
      address: poi.address ?? row.address,
      lat: poi.lat, lng: poi.lng, geocode_attempted: true,
    }).eq('id', row.id);
    if (!error) tagged++;
  }));

  // 3) Repair older auto-filled data with the current caption parser: sentence-y place
  //    names, missing addresses and missing categories. Creator edits are left alone
  //    (they don't look like sentences, and edited addresses already have a value).
  const { data: all } = await supabase
    .from('videos').select('id, caption, place_name, address, category, lat')
    .eq('creator_id', creator.id);
  let repaired = 0;
  await Promise.all((all ?? []).map(async (v) => {
    const fix: Record<string, unknown> = {};
    const loc = extractLocation(v.caption ?? '');
    if (looksLikeSentence(v.place_name)) fix.place_name = loc?.placeName ?? null;
    if (!v.address && v.lat === null && loc) {
      fix.address = loc.address;
      if (!v.place_name && loc.placeName) fix.place_name = loc.placeName;
    }
    if (!v.category) {
      const cat = guessCategory(`${v.caption ?? ''} ${(fix.place_name as string) ?? v.place_name ?? ''}`);
      if (cat) fix.category = cat;
    }
    if (Object.keys(fix).length) {
      repaired++;
      await supabase.from('videos').update(fix).eq('id', v.id);
    }
  }));

  // 4) Geocode anything with an address that hasn't been tried yet.
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

  // Keep the profile fresh: TikTok avatar links expire, and swap the default name for their TikTok nickname.
  const profile: Record<string, unknown> = { last_synced_at: new Date().toISOString() };
  const author = latest[0];
  if (author?.authorAvatar) profile.avatar_url = author.authorAvatar;
  if (author?.authorNickname && (!creator.display_name || creator.display_name === creator.tiktok_username)) {
    profile.display_name = author.authorNickname;
  }
  await supabase.from('creators').update(profile).eq('id', creator.id);

  return NextResponse.json({
    checked: latest.length,
    added: fresh.length,
    mapped,
    tagged, // placed straight from TikTok location tags
    repaired,
    pending: (pending?.length ?? 0) - processed, // still to locate on the next sync
  });
}
