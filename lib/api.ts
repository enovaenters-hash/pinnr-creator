import { getSupabase } from './supabase';

/** Call one of our API routes as the signed-in user. Throws with the server's error message. */
export async function api(path: string, init: RequestInit = {}) {
  const { data } = await getSupabase().auth.getSession();
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session?.access_token ?? ''}`,
      ...(init.headers ?? {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}
