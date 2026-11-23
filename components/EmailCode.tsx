'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { primaryBtn } from '@/components/AuthCard';

const LEN = 6; // Supabase's default email code length (Authentication → Emails). Keep it at 6.

/**
 * "Enter the code we sent you" (kind = 'signup' to confirm a new account, 'recovery' to reset a forgotten password): after sign-up the confirmation email carries a 6-digit code ({{ .Token }}),
 * so people type it here and are signed in without leaving the app or opening a link in another browser.
 */
export default function EmailCode({ email, onVerified, onBack, kind = 'signup' }: {
  email: string; onVerified: () => void; onBack: () => void; kind?: 'signup' | 'recovery';
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [wait, setWait] = useState(30);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);

  async function verify(token: string) {
    if (busy || token.length !== LEN) return;
    setBusy(true); setError(''); setNote('');
    const { error: err } = await getSupabase().auth.verifyOtp({ email, token, type: kind });
    setBusy(false);
    if (err) {
      setError(/expired|invalid/i.test(err.message) ? 'That code didn’t work. Check it or ask for a new one.' : err.message);
      setCode(''); input.current?.focus();
      return;
    }
    onVerified();
  }

  function change(v: string) {
    const digits = v.replace(/\D/g, '').slice(0, LEN);
    setCode(digits); setError('');
    if (digits.length === LEN) verify(digits);
  }

  async function resend() {
    if (wait > 0) return;
    setError(''); setNote('');
    const sb = getSupabase();
    const { error: err } = kind === 'recovery'
      ? await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset` })
      : await sb.auth.resend({ type: 'signup', email });
    if (err) { setError(err.message); return; }
    setNote('New code sent.'); setWait(30); setCode(''); input.current?.focus();
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); verify(code); }} className="text-center">
      <h2 className="font-display text-xl font-semibold text-ink">Enter the code we sent you</h2>
      <p className="text-sm text-gray-600 mt-1 break-words">to <strong>{email}</strong></p>

      <div className="relative mt-5 mx-auto w-fit">
        <div className="flex gap-2" aria-hidden="true">
          {Array.from({ length: LEN }, (_, i) => (
            <span key={i} className={`w-11 h-14 grid place-items-center rounded-xl border-2 bg-white text-2xl font-extrabold text-ink ${i === Math.min(code.length, LEN - 1) ? 'border-ice ring-4 ring-frost' : 'border-gray-300'}`}>
              {code[i] ?? ''}
            </span>
          ))}
        </div>
        <input ref={input} value={code} onChange={(e) => change(e.target.value)} inputMode="numeric" pattern="[0-9]*"
          autoComplete="one-time-code" maxLength={LEN} aria-label={`${LEN}-digit code`}
          className="absolute inset-0 w-full h-full opacity-0 cursor-text" />
      </div>

      <div aria-live="polite" className="min-h-[1.5rem] mt-3 text-sm">
        {error && <p className="text-red-600">{error}</p>}
        {!error && note && <p className="text-green-700 font-bold">{note}</p>}
      </div>

      <button className={`${primaryBtn} mt-1`} disabled={busy || code.length !== LEN}>{busy ? 'Checking…' : '✓ Confirm'}</button>
      <div className="mt-3 flex items-center justify-center gap-4 text-sm">
        <button type="button" onClick={resend} disabled={wait > 0} className="font-bold text-glacier disabled:text-gray-400 disabled:no-underline hover:underline">
          {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
        </button>
        <button type="button" onClick={onBack} className="font-bold text-gray-500 hover:underline">Wrong email?</button>
      </div>
    </form>
  );
}
