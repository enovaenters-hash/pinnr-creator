import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { syncCreator, SyncError } from '@/lib/syncCreator';

// The Sync button places up to this many addresses per press (about 1 per second; the route may run 60s).
const LOOKUPS_PER_PRESS = 35;

export const maxDuration = 60;

/** The Sync button: sync the signed-in creator now. (The automatic sync lives in /api/cron/sync.) */
export async function POST(request: Request) {
  const auth = await getRequestUser(request);
  if (!auth) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  const { user, supabase } = auth;

  const { data: creator } = await supabase
    .from('creators').select('id, tiktok_username, display_name').eq('id', user.id).single();
  if (!creator) return NextResponse.json({ error: 'Creator profile not found.' }, { status: 404 });

  try {
    return NextResponse.json(await syncCreator(supabase, creator, getSupabaseAdmin(), LOOKUPS_PER_PRESS));
  } catch (e) {
    if (e instanceof SyncError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
