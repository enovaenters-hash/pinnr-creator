import { poiFromAnchors } from '@/lib/platforms/tiktok';
import type { Poi } from '@/lib/platforms/types';

/**
 * Read a person's PUBLIC TikTok collections (the folders on their saved-videos tab) through the same web
 * endpoints the tiktok.com profile page uses. Needs no login: a private collection simply isn't listed.
 * Unofficial, so every call can fail; callers show a friendly message instead of crashing.
 */
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.tiktok.com/',
};

export class CollectionError extends Error {}

export interface CollectionInfo { id: string; name: string; total: number }
export interface CollectionItem {
  tiktokId: string;
  caption: string;
  coverUrl: string | null;
  videoUrl: string;
  postedAt: string | null;
  authorHandle: string | null;
  authorName: string | null;
  poi: Poi | null;
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: { ...HEADERS, Accept: 'application/json, text/plain, */*' }, cache: 'no-store' });
  if (!res.ok) throw new CollectionError(`TikTok didn't answer (HTTP ${res.status}).`);
  const text = await res.text();
  try { return JSON.parse(text) as Record<string, unknown>; }
  catch { throw new CollectionError("TikTok didn't send collection data to our server."); }
}

/** The profile's internal id (secUid), read from the profile page. Null when the handle doesn't exist. */
export async function lookupProfile(handle: string): Promise<{ secUid: string; nickname: string | null; isPrivate: boolean } | null> {
  const res = await fetch(`https://www.tiktok.com/@${encodeURIComponent(handle)}`, {
    headers: { ...HEADERS, Accept: 'text/html,application/xhtml+xml' }, cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new CollectionError(`TikTok didn't answer (HTTP ${res.status}).`);
  const html = await res.text();
  const m = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new CollectionError("TikTok didn't send the profile to our server.");
  try {
    const j = JSON.parse(m[1]);
    const u = j?.['__DEFAULT_SCOPE__']?.['webapp.user-detail']?.userInfo?.user;
    if (!u?.secUid) return null;
    return { secUid: u.secUid as string, nickname: (u.nickname as string) ?? null, isPrivate: Boolean(u.privateAccount) };
  } catch { throw new CollectionError("TikTok sent a profile we couldn't read."); }
}

export async function listCollections(secUid: string): Promise<CollectionInfo[]> {
  const out: CollectionInfo[] = [];
  let cursor = '0';
  for (let page = 0; page < 5; page++) {
    const j = await getJson(`https://www.tiktok.com/api/user/collection_list/?aid=1988&count=30&cursor=${cursor}&secUid=${encodeURIComponent(secUid)}`);
    for (const c of (j.collectionList as Array<Record<string, unknown>> | undefined) ?? []) {
      out.push({ id: String(c.collectionId), name: String(c.name ?? 'Collection'), total: Number(c.total) || 0 });
    }
    if (!j.hasMore || !j.cursor) break;
    cursor = String(j.cursor);
  }
  return out;
}

export async function collectionItems(collectionId: string, max = 150): Promise<CollectionItem[]> {
  const out: CollectionItem[] = [];
  let cursor = '0';
  for (let page = 0; page < 8 && out.length < max; page++) {
    const j = await getJson(`https://www.tiktok.com/api/collection/item_list/?aid=1988&collectionId=${encodeURIComponent(collectionId)}&count=30&cursor=${cursor}&sourceType=113`);
    for (const i of (j.itemList as Array<Record<string, unknown>> | undefined) ?? []) {
      const id = String(i.id ?? '');
      if (!id) continue;
      const author = (i.author ?? {}) as { uniqueId?: string; nickname?: string };
      const video = (i.video ?? {}) as { cover?: string; originCover?: string };
      const created = Number(i.createTime);
      out.push({
        tiktokId: id,
        caption: String(i.desc ?? ''),
        coverUrl: video.originCover || video.cover || null,
        videoUrl: `https://www.tiktok.com/@${author.uniqueId ?? 'tiktok'}/video/${id}`,
        postedAt: Number.isFinite(created) && created > 0 ? new Date(created * 1000).toISOString() : null,
        authorHandle: author.uniqueId ?? null,
        authorName: author.nickname ?? null,
        poi: poiFromAnchors(i.anchors) ?? poiFromItem(i.poi),
      });
    }
    if (!j.hasMore || !j.cursor) break;
    cursor = String(j.cursor);
  }
  return out.slice(0, max);
}

/** The simpler `poi` object some responses carry (name, address, category; no coordinates). */
function poiFromItem(p: unknown): Poi | null {
  if (!p || typeof p !== 'object') return null;
  const o = p as Record<string, unknown>;
  const name = String(o.name ?? '').trim();
  if (!name) return null;
  const address = String(o.address ?? '').replace(/,\s*(USA|United States)$/i, '').trim() || null;
  // A bare city tag ("Mesa") isn't a spot.
  if (!address && name.toLowerCase() === String(o.city ?? '').toLowerCase()) return null;
  return { name, address, lat: null, lng: null, kind: (o.ttTypeNameMedium as string) || (o.category as string) || null };
}
