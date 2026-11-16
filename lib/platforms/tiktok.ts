import type { ConnectTokens, ConnectedProfile, OAuthSupport, PlatformProvider, Poi, RawVideo } from './types';

/**
 * Read the location tag (the "📍 Place" label) off a video. TikTok sends it in `anchors` as a
 * `anchor_poi` entry whose `extra` JSON string carries the place name, street address and
 * coordinates. City/region tags ("Phoenix", "Los Angeles") are ignored: they aren't a spot,
 * and would pin every video to the middle of a city.
 */
export function poiFromAnchors(anchors: unknown): Poi | null {
  if (!Array.isArray(anchors)) return null;
  const a = anchors.find((x) => x && (x.component_key === 'anchor_poi' || x.type === 45)) as
    { keyword?: string; extra?: string } | undefined;
  if (!a) return null;

  let ex: Record<string, unknown> = {};
  try { ex = typeof a.extra === 'string' ? JSON.parse(a.extra) : {}; } catch { return null; }

  let info: Record<string, unknown> = {};
  try { info = typeof ex.collect_info === 'string' ? JSON.parse(ex.collect_info) : {}; } catch { /* optional */ }

  const backend = String(ex.poi_backend_type ?? '');
  const regional = info.poi_detail_type === 'regional' || String(ex.type_level) === '1' || /,City\|/.test(backend);
  if (regional) return null;

  const name = String(ex.Name ?? a.keyword ?? '').trim();
  if (!name) return null;

  const loc = (ex.location ?? {}) as { lat?: string | number; lng?: string | number };
  const lat = Number(loc.lat);
  const lng = Number(loc.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
  const address = String(ex.fallback_address ?? '').replace(/,\s*(USA|United States)$/i, '').trim() || null;

  return {
    name,
    address,
    lat: hasCoords ? lat : null,
    lng: hasCoords ? lng : null,
    kind: backend ? backend.split('|')[0].replace(/,/g, ', ') : null,
  };
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
export async function fetchLatestVideos(username: string, count = 20): Promise<RawVideo[]> {
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
      poi: poiFromAnchors(v.anchors),
    };
  }).filter((v) => v.tiktokId);
}


// ───────────────────────── Official API: Login Kit + Display API ─────────────────────────
// Switched off until TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET are set. The Display API has no
// location tags and caps captions at 150 characters, so it is used to PROVE the creator owns the
// handle and as a fallback when the scraper is down, not as the main source.

const OPEN = 'https://open.tiktokapis.com';
// user.info.profile is what returns the @username, which is how we verify the handle.
const SCOPES = 'user.info.basic,user.info.profile,video.list';

const redirectUri = (request: Request) =>
  process.env.TIKTOK_REDIRECT_URI || `${new URL(request.url).origin}/api/connect/tiktok/callback`;

async function tokenCall(body: Record<string, string>): Promise<ConnectTokens & { openId: string }> {
  const res = await fetch(`${OPEN}/v2/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      ...body,
    }),
    cache: 'no-store',
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) {
    throw new Error(j.error_description || j.error || `TikTok sign-in failed (HTTP ${res.status})`);
  }
  const now = Date.now();
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    openId: j.open_id,
    expiresAt: new Date(now + (Number(j.expires_in) || 86400) * 1000).toISOString(),
    refreshExpiresAt: j.refresh_expires_in ? new Date(now + Number(j.refresh_expires_in) * 1000).toISOString() : null,
    scope: j.scope ?? null,
  };
}

const oauth: OAuthSupport = {
  configured: () => Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET),

  authorizeUrl(request, state) {
    const p = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      scope: SCOPES,
      response_type: 'code',
      redirect_uri: redirectUri(request),
      state,
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${p}`;
  },

  async exchangeCode(code, request): Promise<ConnectedProfile> {
    const { openId, ...tokens } = await tokenCall({
      code, grant_type: 'authorization_code', redirect_uri: redirectUri(request),
    });
    const res = await fetch(`${OPEN}/v2/user/info/?fields=open_id,display_name,avatar_url,username`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      cache: 'no-store',
    });
    const j = await res.json().catch(() => ({}));
    const u = j?.data?.user;
    if (!res.ok || !u) throw new Error(j?.error?.message || `Couldn't read your TikTok profile (HTTP ${res.status})`);
    return {
      externalId: String(u.open_id ?? openId),
      handle: u.username ? String(u.username).toLowerCase() : null,
      displayName: u.display_name ?? null,
      avatarUrl: u.avatar_url ?? null,
      tokens,
    };
  },

  async refresh(refreshToken) {
    const { openId: _open, ...tokens } = await tokenCall({ grant_type: 'refresh_token', refresh_token: refreshToken });
    void _open;
    return tokens;
  },

  async fetchOwnVideos(accessToken, handle, count) {
    const fields = 'id,create_time,cover_image_url,share_url,video_description,title';
    const res = await fetch(`${OPEN}/v2/video/list/?fields=${fields}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_count: Math.min(count, 20) }),
      cache: 'no-store',
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || (j?.error?.code && j.error.code !== 'ok')) {
      throw new Error(j?.error?.message || `TikTok video list failed (HTTP ${res.status})`);
    }
    return ((j?.data?.videos ?? []) as Array<Record<string, unknown>>).map((v): RawVideo => {
      const id = String(v.id ?? '');
      const created = Number(v.create_time);
      // Both fields are capped at 150 characters; keep whichever carries more of the caption.
      const desc = String(v.video_description ?? '');
      const title = String(v.title ?? '');
      return {
        tiktokId: id,
        caption: desc.length >= title.length ? desc : title,
        coverUrl: (v.cover_image_url as string) || null,
        videoUrl: `https://www.tiktok.com/@${handle}/video/${id}`,
        postedAt: Number.isFinite(created) && created > 0 ? new Date(created * 1000).toISOString() : null,
        authorNickname: null,
        authorAvatar: null,
        poi: null, // the official API doesn't expose location tags
      };
    }).filter((v) => v.tiktokId);
  },

  async revoke(accessToken) {
    await fetch(`${OPEN}/v2/oauth/revoke/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        token: accessToken,
      }),
    }).catch(() => undefined);
  },
};

export const tiktok: PlatformProvider = {
  id: 'tiktok',
  label: 'TikTok',
  handleColumn: 'tiktok_username',
  fetchLatest: fetchLatestVideos,
  oauth,
};
