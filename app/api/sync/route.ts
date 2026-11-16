import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { syncCreator, SyncError } from '@/lib/syncCreator';

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
    return NextResponse.json(await syncCreator(supabase, creator, getSupabaseAdmin()));
  } catch (e) {
    if (e instanceof SyncError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
