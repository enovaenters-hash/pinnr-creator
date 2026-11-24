export interface Creator {
  id: string;
  tiktok_username: string;
  display_name: string | null;
  avatar_url: string | null;
  last_synced_at: string | null;
  created_at: string;
  /** What the creator posts about (one or several); fans filter Discover by it. */
  content_types?: string[] | null;
  /** Older single-type column, kept in sync with the first of content_types. */
  content_type?: string | null;
  /** Set by an admin: the profile, videos and locations are hidden from public view. */
  hidden?: boolean;
}

/** Content types a creator can attach to their feed. */
export const CONTENT_TYPES = [
  { key: 'food', label: 'Food' },
  { key: 'fashion', label: 'Fashion' },
  { key: 'travel', label: 'Travel' },
  { key: 'events', label: 'Events' },
  { key: 'other', label: 'Other' },
] as const;

/** A creator's content types as a clean list: newest column first, then the old single column, else Food. */
export function creatorTypes(c: { content_types?: string[] | null; content_type?: string | null } | null | undefined): string[] {
  const valid = new Set<string>(CONTENT_TYPES.map((t) => t.key));
  const list = (c?.content_types?.length ? c.content_types : c?.content_type ? [c.content_type] : ['food'])
    .filter((t) => valid.has(t));
  return list.length ? list : ['food'];
}

export interface Video {
  id: string;
  creator_id: string;
  tiktok_id: string;
  caption: string | null;
  cover_url: string | null;
  video_url: string | null;
  posted_at: string | null;
  place_name: string | null;
  category: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  geocode_attempted: boolean;
  discount_code: string | null;
  featured: boolean;
  hidden: boolean;
  created_at: string;
}

export const CATEGORIES = [
  'pizza', 'burgers', 'tacos', 'mexican', 'bbq', 'soulfood', 'seafood', 'sushi',
  'japanese', 'ramen', 'korean', 'chinese', 'thai', 'vietnamese', 'indian',
  'italian', 'mediterranean', 'caribbean', 'brunch', 'cafe', 'bakery', 'dessert',
  'bar', 'other',
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  pizza: '#ef4444', burgers: '#f97316', tacos: '#ec4899', mexican: '#db2777',
  bbq: '#92400e', soulfood: '#b45309', seafood: '#0ea5e9', sushi: '#e11d48',
  japanese: '#be123c', ramen: '#f59e0b', korean: '#ea580c', chinese: '#dc2626',
  thai: '#a855f7', vietnamese: '#16a34a', indian: '#f59e0b', italian: '#15803d',
  mediterranean: '#0891b2', caribbean: '#65a30d', brunch: '#eab308', cafe: '#78350f',
  bakery: '#d97706', dessert: '#f472b6', bar: '#7c3aed', other: '#3b82f6',
};

export function categoryColor(category: string | null | undefined): string {
  return CATEGORY_COLORS[category ?? 'other'] ?? CATEGORY_COLORS.other;
}
