import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only client with the service-role key (bypasses RLS). Used only for the private
 * connection-token table and the "verified" flag. Returns null when the key isn't configured,
 * so everything that needs it switches itself off instead of crashing.
 * Never import this from a client component.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
