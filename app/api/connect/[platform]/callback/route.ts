import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getProvider } from '@/lib/platforms';
import { connectEnabled, readState } from '@/lib/connect';

/**
 * Step 2: the platform sends the creator back here with a one-time code. We trade it for tokens,
 * learn who they are, and — because they logged in on the platform itself — mark the handle verified.
 */
export async function GET(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const url = new URL(request.url);
  const back = (q: Record<string, string>) =>
    NextResponse.redirect(new URL(`/dashboard?${new URLSearchParams(q)}`, url.origin));

  const provider = getProvider(platform);
  const admin = getSupabaseAdmin();
  if (!provider?.oauth || !admin || !connectEnabled(provider)) return back({ connect_error: 'Not switched on yet.' });

  if (url.searchParams.get('error')) return back({ connect_error: 'You cancelled, or the platform said no.' });
  const creatorId = readState(url.searchParams.get('state'), provider.id);
  const code = url.searchParams.get('code');
  if (!creatorId || !code) return back({ connect_error: 'That link expired. Please try again.' });

  try {
    const profile = await provider.oauth.exchangeCode(code, request);

    const col = provider.handleColumn;
    const { data: creator } = await admin.from('creators').select(`id, display_name, avatar_url, ${col}`).eq('id', creatorId).maybeSingle();
    if (!creator) return back({ connect_error: 'Creator profile not found.' });
    const current = (creator as unknown as Record<string, string | null>)[col];

    // The handle they logged in with is the real one. Adopt it if it differs from what they typed,
    // unless a different POVGo account already holds it.
    const update: Record<string, string> = {};
    if (profile.handle && profile.handle !== current) {
      const { data: taken } = await admin.from('creators').select('id').eq(col, profile.handle).neq('id', creatorId).maybeSingle();
      if (taken) return back({ connect_error: `@${profile.handle} is already used by another POVGo account. Contact us and we’ll sort it out.` });
      update[col] = profile.handle;
    }
    if (profile.avatarUrl) update.avatar_url = profile.avatarUrl;
    if (profile.displayName && (!creator.display_name || creator.display_name === current)) update.display_name = profile.displayName;
    if (Object.keys(update).length) await admin.from('creators').update(update).eq('id', creatorId);

    const { error } = await admin.from('social_connections').upsert({
      creator_id: creatorId,
      platform: provider.id,
      external_id: profile.externalId,
      handle: profile.handle,
      access_token: profile.tokens.accessToken,
      refresh_token: profile.tokens.refreshToken,
      expires_at: profile.tokens.expiresAt,
      refresh_expires_at: profile.tokens.refreshExpiresAt,
      scope: profile.tokens.scope,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'creator_id,platform' });
    if (error) {
      return back({ connect_error: /unique|duplicate/i.test(error.message)
        ? `That ${provider.label} account is already connected to another POVGo account.`
        : 'Couldn’t save the connection. Please try again.' });
    }

    await admin.from('creator_verified').upsert({ creator_id: creatorId, platform: provider.id }, { onConflict: 'creator_id,platform' });
    return back({ connected: provider.id });
  } catch (e) {
    return back({ connect_error: (e as Error).message || 'Something went wrong. Please try again.' });
  }
}
