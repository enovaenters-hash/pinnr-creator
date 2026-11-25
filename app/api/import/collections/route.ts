import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getRequestUser } from '@/lib/supabase';
import { geocode, sleep } from '@/lib/geocode';
import { extractLocation, geocodeCandidates, guessCategory } from '@/lib/location';
import { CollectionError, collectionItems, listCollections, lookupProfile } from '@/lib/tiktokCollections';

export const maxDuration = 60;
const LOOKUPS_PER_CALL = 30;

/**
 * "Import my TikTok collections". Three steps, all for the signed-in person:
 *   list     { handle }                         -> their public collections
 *   import   { handle, collectionId, name }     -> save that collection's videos as private imported spots
 *   geocode  {}                                 -> place addresses that came without coordinates (a few per call)
 */
export async function POST(request: Request) {
  const auth = await getRequestUser(request);
  if (!auth) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  const { user, supabase } = auth;
  const body = (await request.json().catch(() => ({}))) as {
    action?: string; handle?: string; collectionId?: string; name?: string;
  };
  const handle = (body.handle ?? '').replace(/^@/, '').trim().toLowerCase();

  try {
    if (body.action === 'list') {
      if (!/^[a-z0-9._]{2,40}$/.test(handle)) return NextResponse.json({ error: 'Enter your TikTok @username.' }, { status: 400 });
      const profile = await lookupProfile(handle);
      if (!profile) return NextResponse.json({ error: `Couldn't find @${handle} on TikTok.` }, { status: 404 });
      const collections = await listCollections(profile.secUid);
      return NextResponse.json({ handle, nickname: profile.nickname, isPrivate: profile.isPrivate, collections });
    }

    if (body.action === 'import') {
      if (!body.collectionId) return NextResponse.json({ error: 'Pick a collection.' }, { status: 400 });
      const items = await collectionItems(body.collectionId);
      const colName = (body.name ?? 'TikTok collection').slice(0, 60);
      const rows = items.map((v) => {
        const loc = extractLocation(v.caption);
        const poi = v.poi;
        const placed = poi !== null && poi.lat !== null && poi.lng !== null;
        const placeName = poi?.name || loc?.placeName || null;
        return {
          user_id: user.id,
          tiktok_id: v.tiktokId,
          collection_id: body.collectionId,
          collection_name: colName,
          author_handle: v.authorHandle,
          author_name: v.authorName,
          caption: v.caption,
          cover_url: v.coverUrl,
          video_url: v.videoUrl,
          posted_at: v.postedAt,
          place_name: placeName,
          address: poi?.address ?? loc?.address ?? null,
          lat: placed ? poi.lat : null,
          lng: placed ? poi.lng : null,
          geocode_attempted: placed,
          category: guessCategory(`${v.caption} ${placeName ?? ''} ${poi?.kind ?? ''}`),
        };
      });
      if (rows.length) {
        const { error } = await supabase.from('imported_spots').upsert(rows, { onConflict: 'user_id,tiktok_id', ignoreDuplicates: true });
        if (error) throw new CollectionError(error.message);
      }
      const withPlace = rows.filter((r) => r.address || r.place_name).length;
      return NextResponse.json({ found: rows.length, withPlace, noPlace: rows.length - withPlace, ...(await pendingCount(supabase, user.id)) });
    }

    if (body.action === 'geocode') {
      const { data: todo } = await supabase.from('imported_spots').select('id, address, place_name')
        .eq('user_id', user.id).is('lat', null).not('address', 'is', null).eq('geocode_attempted', false).limit(LOOKUPS_PER_CALL);
      const cache = new Map<string, { lat: number; lng: number } | null>();
      let first = true;
      for (const r of todo ?? []) {
        const key = (r.address as string).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        if (!cache.has(key)) {
          let hit: { lat: number; lng: number } | null = null;
          for (const q of geocodeCandidates(r.address as string, r.place_name as string | null)) {
            if (!first) await sleep(1100);
            first = false;
            const g = await geocode(q);
            if (g) { hit = { lat: g.lat, lng: g.lng }; break; }
          }
          cache.set(key, hit);
        }
        const hit = cache.get(key);
        await supabase.from('imported_spots').update({ lat: hit?.lat ?? null, lng: hit?.lng ?? null, geocode_attempted: true }).eq('id', r.id);
      }
      return NextResponse.json(await pendingCount(supabase, user.id));
    }

    return NextResponse.json({ error: 'Unknown request.' }, { status: 400 });
  } catch (e) {
    const msg = (e as Error).message || 'Import failed.';
    const status = e instanceof CollectionError ? 502 : 500;
    return NextResponse.json({ error: /imported_spots/.test(msg) ? 'Imports need one setup step: run supabase/imports.sql in Supabase.' : msg }, { status });
  }
}

async function pendingCount(supabase: SupabaseClient, userId: string) {
  const { count } = await supabase.from('imported_spots').select('id', { count: 'exact', head: true })
    .eq('user_id', userId).is('lat', null).not('address', 'is', null).eq('geocode_attempted', false);
  return { pending: count ?? 0 };
}
