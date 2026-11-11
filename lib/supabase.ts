import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Vercel's Supabase integration sets these automatically.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

let browserClient: SupabaseClient | null = null;

/** Browser client (session kept in localStorage). Created lazily so builds work without env vars. */
export function getSupabase(): SupabaseClient {
  if (!supabaseConfigured) throw new Error('Supabase is not configured');
  if (!browserClient) browserClient = createClient(url!, anonKey!);
  return browserClient;
}

/** Server client that acts as the signed-in user (RLS applies). */
export function getSupabaseForToken(accessToken: string): SupabaseClient {
  if (!supabaseConfigured) throw new Error('Supabase is not configured');
  return createClient(url!, anonKey!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Resolve the user behind an API request's Bearer token. */
export async function getRequestUser(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supabase = getSupabaseForToken(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, supabase };
}
