import { CATEGORIES } from './types';

export interface RawTikTokVideo {
  tiktokId: string;
  caption: string;
  coverUrl: string | null;
  videoUrl: string;
  postedAt: string | null;
  authorNickname: string | null;
  authorAvatar: string | null;
}

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.tikwm.com/',
};

type TikwmResponse = { code?: number; msg?: string; data?: { videos?: Array<Record<string, unknown>> } };

/**
 * Get the raw post list. Two unofficial sources, same response format:
 *  - TIKTOK_RAPIDAPI_KEY set → TikWM's RapidAPI listing ("TikTok Scraper", tiktok-scraper7),
 *    which works from servers.
 *  - otherwise → the free public TikWM endpoint (may block cloud servers with 403).
 */
async function fetchPosts(handle: string, count: number): Promise<TikwmResponse> {
  const params = new URLSearchParams({ unique_id: handle, count: String(count), cursor: '0' });
  const rapidKey = process.env.TIKTOK_RAPIDAPI_KEY;

  if (rapidKey) {
    const host = process.env.TIKTOK_RAPIDAPI_HOST || 'tiktok-scraper7.p.rapidapi.com';
    const res = await fetch(`https://${host}/user/posts?${params}`, {
      headers: { 'x-rapidapi-key': rapidKey, 'x-rapidapi-host': host },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`TikTok lookup failed (RapidAPI HTTP ${res.status})`);
    return res.json();
  }

  let res = await fetch('https://www.tikwm.com/api/user/posts', {
    method: 'POST',
    headers: { ...BROWSER_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
    cache: 'no-store',
  });
  if (!res.ok) {
    res = await fetch(`https://www.tikwm.com/api/user/posts?${params}`, { headers: BROWSER_HEADERS, cache: 'no-store' });
  }
  if (res.status === 403) {
    throw new Error('TikTok lookup blocked (HTTP 403). The free source blocks our server — add TIKTOK_RAPIDAPI_KEY in Vercel.');
  }
  if (!res.ok) throw new Error(`TikTok lookup failed (HTTP ${res.status})`);
  return res.json();
}

/**
 * Fetch a creator's latest public videos. This is the only function that knows where
 * TikTok data comes from — swap it for an official/paid provider later.
 */
export async function fetchLatestVideos(username: string, count = 20): Promise<RawTikTokVideo[]> {
  const handle = username.replace(/^@/, '').trim().toLowerCase();
  const json = await fetchPosts(handle, count);
  if (json.code !== 0) {
    throw new Error(json.msg ? `TikTok lookup failed: ${json.msg}` : 'TikTok lookup failed');
  }

  return (json.data?.videos ?? []).map((v) => {
    const id = String(v.video_id ?? v.aweme_id ?? v.id ?? '');
    const created = Number(v.create_time);
    const author = (v.author ?? {}) as { nickname?: string; avatar?: string };
    return {
      tiktokId: id,
      caption: String(v.title ?? ''),
      coverUrl: (v.origin_cover as string) || (v.cover as string) || null,
      videoUrl: `https://www.tiktok.com/@${handle}/video/${id}`,
      postedAt: Number.isFinite(created) && created > 0 ? new Date(created * 1000).toISOString() : null,
      authorNickname: author.nickname || null,
      authorAvatar: author.avatar || null,
    };
  }).filter((v) => v.tiktokId);
}

// "4435 S Rural Rd, Tempe, AZ 85282" — street number, street, city, state (+ optional ZIP)
const US_STREET = /\b\d{1,6}\s+[A-Za-z0-9.'#\- ]+?,\s*[A-Za-z.'\- ]+?,\s*[A-Z]{2}\b(?:\s+\d{5})?/;

/**
 * Pull a location out of a caption. Handles, in order:
 *   "Thaitanic Kitchen 4435 S Rural Rd, Tempe, AZ 85282 #fyp"  (name + US street address)
 *   "📍 Joe's Pizza, 7 Carmine St NYC"
 *   "Location: ..." / "Address: ..."
 * Returns null when nothing is found so the creator can fill it in by hand.
 */
export function extractLocation(caption: string): { placeName: string; address: string } | null {
  const street = caption.match(US_STREET);
  if (street && street.index !== undefined) {
    const before = caption.slice(0, street.index).split('\n').map((l) => l.trim()).filter(Boolean).pop() ?? '';
    const placeName = before.replace(/📍/gu, '').replace(/[\s,:\-–|]+$/, '').split(/,\s/)[0].trim();
    return { placeName, address: street[0].trim() };
  }

  const patterns = [
    /📍\s*([^\n#]+)/u,
    /\b(?:location|address|addy)\s*[:\-–]\s*([^\n#]+)/i,
  ];
  for (const p of patterns) {
    const m = caption.match(p);
    if (m) {
      const address = m[1].replace(/\s+/g, ' ').replace(/[|•]+$/, '').trim();
      if (address.length < 3) continue;
      const placeName = address.split(/[,|–-]/)[0].trim();
      return { placeName, address };
    }
  }
  return null;
}

/** Geocoder queries to try for an address, most specific first. */
export function geocodeCandidates(address: string, placeName?: string | null): string[] {
  const out = [address];
  const noUnit = address.replace(/\s*\b(?:ste|suite|unit|apt)\.?\s*[\w-]+|\s*#\s*[\w-]+/gi, '');
  out.push(noUnit);
  if (placeName && address.toLowerCase().startsWith(placeName.toLowerCase())) {
    const rest = address.slice(placeName.length).replace(/^[\s,|–-]+/, '');
    if (/\d/.test(rest)) out.push(rest); // only street-level, never a bare city
  }
  return [...new Set(out.map((s) => s.trim()).filter(Boolean))];
}

const CATEGORY_ALIASES: Record<string, string> = {
  taco: 'tacos', burger: 'burgers', bbq: 'bbq', barbecue: 'bbq', bakery: 'bakery',
  greek: 'mediterranean', gyro: 'mediterranean', gyros: 'mediterranean', sushi: 'sushi',
  donut: 'dessert', donuts: 'dessert', icecream: 'dessert', coffee: 'cafe',
  wings: 'soulfood', chicken: 'soulfood', jerk: 'caribbean', pho: 'vietnamese',
  dimsum: 'chinese', brunch: 'brunch', cocktails: 'bar',
};

/** Guess a category from hashtags/words in the caption. */
export function guessCategory(caption: string): string | null {
  const words = caption.toLowerCase().match(/[a-z]+/g) ?? [];
  for (const w of words) {
    if ((CATEGORIES as readonly string[]).includes(w) && w !== 'other') return w;
    if (CATEGORY_ALIASES[w]) return CATEGORY_ALIASES[w];
  }
  return null;
}
