'use client';

import { useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { PasswordField, primaryBtn } from '@/components/AuthCard';

/** Choose a new password once you're signed in through a reset code or reset link. */
export default function NewPassword({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) { setError('Use at least 6 characters.'); return; }
    setBusy(true); setError('');
    const { error: err } = await getSupabase().auth.updateUser({ password: pw });
    setBusy(false);
    if (err) { setError(err.message); return; }
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="text-xs font-medium text-gray-600">New password</span>
        <PasswordField id="new-password" value={pw} onChange={setPw} autoComplete="new-password" minLength={6} />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className={primaryBtn} disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
    </form>
  );
}
