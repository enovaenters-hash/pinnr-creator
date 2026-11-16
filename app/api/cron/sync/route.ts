import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { syncCreator } from '@/lib/syncCreator';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Stop starting new creators after this long, leaving room to finish the current one.
const BUDGET_MS = 40_000;
// A creator who synced more recently than this (for example by pressing Sync) is skipped.
const FRESH_MS = 3 * 60 * 60 * 1000;
// Geocoding is rate-limited to ~1/second, so keep each creator's share small.
const LOOKUPS_PER_CREATOR = 5;

/**
 * Automatic sync, called on a schedule by Vercel Cron (see vercel.json). Goes through creators
 * stalest-first, so over several runs everyone is covered even if one run can't finish them all.
 * Protected by CRON_SECRET: Vercel sends it as "Authorization: Bearer <secret>".
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set.' }, { status: 501 });

  const { data: creators, error } = await admin
    .from('creators').select('id, tiktok_username, display_name, last_synced_at')
    .order('last_synced_at', { ascending: true, nullsFirst: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const started = Date.now();
  let synced = 0, skippedFresh = 0, skippedTime = 0, added = 0;
  const failed: { creator: string; error: string }[] = [];

  for (const c of creators ?? []) {
    if (c.last_synced_at && started - new Date(c.last_synced_at).getTime() < FRESH_MS) { skippedFresh++; continue; }
    if (Date.now() - started > BUDGET_MS) { skippedTime++; continue; }
    try {
      const r = await syncCreator(admin, c, admin, LOOKUPS_PER_CREATOR);
      synced++; added += r.added;
    } catch (e) {
      failed.push({ creator: c.tiktok_username, error: (e as Error).message });
      // Move a failing creator to the back of the line so it can't block everyone else.
      await admin.from('creators').update({ last_synced_at: new Date().toISOString() }).eq('id', c.id);
    }
  }

  return NextResponse.json({ creators: creators?.length ?? 0, synced, added, skippedFresh, skippedTime, failed });
}
