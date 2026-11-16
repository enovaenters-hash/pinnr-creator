import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConnectTokens, PlatformProvider } from './platforms/types';

/** Server-only helpers for "Connect your account" (shared by every platform). */

const secret = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const b64 = (s: string) => Buffer.from(s).toString('base64url');
const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

/** A signed, 10-minute "state" that ties the round-trip through the platform back to this creator. */
export function makeState(creatorId: string, platform: string): string {
  const payload = b64(JSON.stringify({ u: creatorId, p: platform, e: Date.now() + 10 * 60_000, n: randomBytes(8).toString('hex') }));
  return `${payload}.${sign(payload)}`;
}

export function readState(state: string | null, platform: string): string | null {
  if (!state || !secret()) return null;
  const [payload, sig] = state.split('.');
  if (!payload || !sig) return null;
  const want = Buffer.from(sign(payload));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const { u, p, e } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return p === platform && typeof u === 'string' && typeof e === 'number' && e > Date.now() ? u : null;
  } catch { return null; }
}

/** Connected and usable? Connecting needs the platform's keys AND the service-role key. */
export const connectEnabled = (provider: PlatformProvider) =>
  Boolean(provider.oauth?.configured() && process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * A working access token for this creator and platform, refreshed (and saved) when it is about to
 * expire. Returns null if they haven't connected, or the connection can no longer be renewed.
 */
export async function freshAccessToken(
  admin: SupabaseClient, creatorId: string, provider: PlatformProvider,
): Promise<string | null> {
  if (!provider.oauth) return null;
  const { data: row } = await admin.from('social_connections').select('*')
    .eq('creator_id', creatorId).eq('platform', provider.id).maybeSingle();
  if (!row) return null;

  if (new Date(row.expires_at).getTime() - Date.now() > 10 * 60_000) return row.access_token as string;

  try {
    const t: ConnectTokens = await provider.oauth.refresh(row.refresh_token as string);
    await admin.from('social_connections').update({
      access_token: t.accessToken, refresh_token: t.refreshToken, expires_at: t.expiresAt,
      refresh_expires_at: t.refreshExpiresAt, scope: t.scope, updated_at: new Date().toISOString(),
    }).eq('creator_id', creatorId).eq('platform', provider.id);
    return t.accessToken;
  } catch {
    return null;
  }
}
