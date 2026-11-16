import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { allProviders } from '@/lib/platforms';
import { connectEnabled } from '@/lib/connect';

/** Which platforms the signed-in creator can connect, and which they already have. */
export async function GET(request: Request) {
  const auth = await getRequestUser(request);
  if (!auth) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: rows } = admin
    ? await admin.from('social_connections').select('platform, handle').eq('creator_id', auth.user.id)
    : { data: null };
  const mine = new Map((rows ?? []).map((r) => [r.platform as string, r.handle as string | null]));

  return NextResponse.json({
    platforms: allProviders().filter((p) => p.oauth).map((p) => ({
      id: p.id,
      label: p.label,
      available: connectEnabled(p),
      connected: mine.has(p.id),
      handle: mine.get(p.id) ?? null,
    })),
  });
}
