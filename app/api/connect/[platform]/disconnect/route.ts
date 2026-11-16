import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getProvider } from '@/lib/platforms';

/** Forget the connection: tell the platform, delete our copy of the tokens, drop the verified mark. */
export async function POST(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const provider = getProvider(platform);
  const admin = getSupabaseAdmin();
  if (!provider?.oauth || !admin) return NextResponse.json({ error: 'Not available.' }, { status: 404 });

  const auth = await getRequestUser(request);
  if (!auth) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

  const { data: row } = await admin.from('social_connections').select('access_token')
    .eq('creator_id', auth.user.id).eq('platform', provider.id).maybeSingle();
  if (row?.access_token && provider.oauth.configured()) await provider.oauth.revoke(row.access_token as string);

  await admin.from('social_connections').delete().eq('creator_id', auth.user.id).eq('platform', provider.id);
  await admin.from('creator_verified').delete().eq('creator_id', auth.user.id).eq('platform', provider.id);
  return NextResponse.json({ ok: true });
}
