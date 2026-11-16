'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface PlatformState { id: string; label: string; available: boolean; connected: boolean; handle: string | null }
type Tone = 'info' | 'ok' | 'err';

/**
 * "Connected accounts": log in with the platform to prove the handle is yours and sync through
 * the official API. Lists whatever platforms the server offers (TikTok today, Instagram later)
 * and stays hidden until at least one is switched on.
 */
export default function ConnectedAccounts({ onMessage, onChanged }: {
  onMessage: (text: string, tone: Tone) => void;
  onChanged?: () => void;
}) {
  const [platforms, setPlatforms] = useState<PlatformState[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setPlatforms((await api('/api/connect/status')).platforms ?? []); } catch { setPlatforms([]); }
  }, []);

  useEffect(() => {
    load();
    // Coming back from the platform: show how it went, then tidy the address bar.
    const q = new URLSearchParams(window.location.search);
    const done = q.get('connected');
    const err = q.get('connect_error');
    if (done) onMessage('Account connected. Your handle is now verified.', 'ok');
    else if (err) onMessage(err, 'err');
    if (done || err) window.history.replaceState(null, '', window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  async function connect(p: PlatformState) {
    setBusy(p.id);
    try {
      const { url } = await api(`/api/connect/${p.id}/start`, { method: 'POST' });
      window.location.href = url;
    } catch (e) {
      onMessage((e as Error).message, 'err');
      setBusy(null);
    }
  }

  async function disconnect(p: PlatformState) {
    setBusy(p.id);
    try {
      await api(`/api/connect/${p.id}/disconnect`, { method: 'POST' });
      onMessage(`${p.label} disconnected.`, 'ok');
      await load();
      onChanged?.();
    } catch (e) {
      onMessage((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  }

  const shown = platforms.filter((p) => p.available || p.connected);
  if (shown.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="text-xs font-bold text-gray-500 mb-1.5">Connected accounts</p>
      <div className="flex flex-col gap-1.5">
        {shown.map((p) => (
          <div key={p.id} className="flex items-center gap-2 text-sm">
            {p.connected ? (
              <>
                <span className="font-bold text-green-700">✓ {p.label} verified{p.handle ? ` (@${p.handle})` : ''}</span>
                <button type="button" disabled={busy === p.id} onClick={() => disconnect(p)}
                  className="ml-auto text-xs text-gray-500 hover:text-gray-900">Disconnect</button>
              </>
            ) : (
              <>
                <span className="text-gray-600">Prove it&apos;s you and sync with {p.label}</span>
                <button type="button" disabled={busy === p.id} onClick={() => connect(p)}
                  className="btn-ghost ml-auto px-3.5 py-1.5 text-xs">{busy === p.id ? 'Opening…' : `Connect ${p.label}`}</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
