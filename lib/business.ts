import type { SupabaseClient } from '@supabase/supabase-js';
import type { PublicVideo } from '@/components/PublicMap';

/** Letters and numbers only, lowercase: "Thai Tanic!" -> "thaitanic". Used for slugs and name matching. */
export const normKey = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export interface BusinessInfo {
  slug: string;
  name: string;
  match_key: string;
  bio: string;
  address: string;
  website: string;
  top_video_ids: string[];
  created_at?: string;
  updated_at?: string;
}

/** Does this video belong to the business with this match key? */
export const matchesKey = (v: { place_name: string | null }, key: string) => Boolean(key) && normKey(v.place_name).includes(key);

/**
 * Every public creator video whose place name contains `key`. The database does a loose match (the key's letters in
 * order) and the exact check happens here, so "Thai Tanic", "THAITANIC" and "Thaitanic Kitchen" all count.
 */
export async function fetchBusinessVideos(sb: SupabaseClient, key: string): Promise<PublicVideo[]> {
  if (!key) return [];
  const { data } = await sb.from('videos')
    .select('*, creators!inner(tiktok_username, display_name, avatar_url)')
    .eq('hidden', false).ilike('place_name', `%${key.split('').join('%')}%`)
    .order('posted_at', { ascending: false, nullsFirst: false }).limit(300);
  return ((data ?? []) as unknown as PublicVideo[]).filter((v) => matchesKey(v, key));
}
