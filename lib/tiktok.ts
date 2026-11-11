import { CATEGORIES } from './types';

export interface RawTikTokVideo {
  tiktokId: string;
  caption: string;
  coverUrl: string | null;
  videoUrl: string;
  postedAt: string | null;
}

/**
 * Fetch a creator's latest public videos.
 *
 * Uses the unofficial TikWM API (no key, ~1 request/second limit). This is the MVP
 * data source and may break if TikTok or TikWM change; swap this one function for an
 * official/paid provider later without touching the rest of the app.
 */
export async function fetchLatestVideos(username: string, count = 20): Promise<RawTikTokVideo[]> {
  const handle = username.replace(/^@/, '').trim().toLowerCase();
  const body = new URLSearchParams({ unique_id: handle, count: String(count), cursor: '0' });

  const res = await fetch('https://www.tikwm.com/api/user/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (compatible; Pinnr/0.2)',
    },
    body,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`TikTok lookup failed (HTTP ${res.status})`);

  const json = (await res.json()) as {
    code?: number;
    msg?: string;
    data?: { videos?: Array<Record<string, unknown>> };
  };
  if (json.code !== 0) {
    throw new Error(json.msg ? `TikTok lookup failed: ${json.msg}` : 'TikTok lookup failed');
  }

  return (json.data?.videos ?? []).map((v) => {
    const id = String(v.video_id ?? v.aweme_id ?? v.id ?? '');
    const created = Number(v.create_time);
    return {
      tiktokId: id,
      caption: String(v.title ?? ''),
      coverUrl: (v.origin_cover as string) || (v.cover as string) || null,
      videoUrl: `https://www.tiktok.com/@${handle}/video/${id}`,
      postedAt: Number.isFinite(created) && created > 0 ? new Date(created * 1000).toISOString() : null,
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
