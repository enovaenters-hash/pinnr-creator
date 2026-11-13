// Shared types and helpers for the fan side: follows, saved videos ("My Videos"), lists and the fan map.

export interface FanCreator {
  id: string;
  tiktok_username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface FanVideo {
  id: string;
  tiktok_id: string;
  place_name: string | null;
  category: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  cover_url: string | null;
  video_url: string | null;
  posted_at: string | null;
  creator_id: string;
  creators: (Pick<FanCreator, 'tiktok_username' | 'display_name' | 'avatar_url'> & { content_type?: string }) | null;
}

export interface SavedVideo { savedAt: string; video: FanVideo }
export interface FanList { id: string; name: string; videoIds: string[] }

export const FAN_VIDEO_FIELDS =
  'id, tiktok_id, place_name, category, address, lat, lng, cover_url, video_url, posted_at, creator_id, creators(tiktok_username, display_name, avatar_url, content_type)';

const CAT_LABELS: Record<string, string> = { soulfood: 'Soul Food', bbq: 'BBQ', cafe: 'Café' };
export const catLabel = (c: string | null) => (c ? CAT_LABELS[c] ?? c.charAt(0).toUpperCase() + c.slice(1) : '');

/** "4435 S Rural Rd, Tempe, AZ 85282" → "Tempe, AZ" */
export function cityOf(addr: string | null): string {
  const parts = (addr ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 3) return `${parts[parts.length - 2]}, ${parts[parts.length - 1].split(' ')[0]}`;
  return parts[parts.length - 1] ?? '';
}

export function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

/** Straight-line distance in miles. */
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

export const formatMiles = (m: number) => (m < 10 ? `${m.toFixed(1)} mi` : `${Math.round(m)} mi`);

/** Where tapping a video should go: the fan map focused on it, or TikTok if it has no pin. */
export const videoHref = (v: FanVideo) => (v.lat !== null ? `/map?focus=${v.id}` : v.video_url ?? '#');
