import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/supabase';
import { getProvider } from '@/lib/platforms';
import { connectEnabled, makeState } from '@/lib/connect';

/** Step 1: give the browser the platform's "approve POVGo" address for this creator. */
export async function POST(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const provider = getProvider(platform);
  if (!provider?.oauth) return NextResponse.json({ error: 'That platform can’t be connected.' }, { status: 404 });
  if (!connectEnabled(provider)) {
    return NextResponse.json({ error: `${provider.label} login isn’t switched on yet.` }, { status: 501 });
  }

  const auth = await getRequestUser(request);
  if (!auth) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  const { data: creator } = await auth.supabase.from('creators').select('id').eq('id', auth.user.id).maybeSingle();
  if (!creator) return NextResponse.json({ error: 'Set up your creator profile first.' }, { status: 400 });

  return NextResponse.json({ url: provider.oauth.authorizeUrl(request, makeState(auth.user.id, provider.id)) });
}
