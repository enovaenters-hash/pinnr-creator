'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { AuthCard, PasswordField, inputClass, primaryBtn } from '@/components/AuthCard';
import EmailCode from '@/components/EmailCode';
import NewPassword from '@/components/NewPassword';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [forgot, setForgot] = useState<'off' | 'email' | 'code' | 'newpw'>('off'); // forgotten password flow
  const [needCode, setNeedCode] = useState(false); // signed up but never confirmed: finish with the emailed code

  function done() {
    const next = new URLSearchParams(window.location.search).get('next');
    router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/fan');
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setBusy(true);
    const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset` });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setForgot('code');
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error && /not confirmed/i.test(error.message)) {
      // Never finished confirming: send a fresh code and let them type it here.
      const sent = await supabase.auth.resend({ type: 'signup', email });
      setBusy(false);
      if (sent.error) { setError(sent.error.message); return; }
      setNeedCode(true);
      return;
    }
    setBusy(false);
    if (error) { setError(error.message); return; }
    done();
  }

  return (
    <AuthCard
      title={forgot === 'off' ? 'Welcome back' : forgot === 'newpw' ? 'Choose a new password' : 'Reset your password'}
      subtitle={forgot === 'off' ? 'Sign in to your POVGo account.' : forgot === 'email' ? 'Enter your email and we’ll send you a code to reset it.' : forgot === 'newpw' ? 'Pick something you’ll remember. Tap Show to check it.' : 'Check your email for a code (or tap the link in it).'}
      footer={<>New here? <Link href="/signup" className="text-blue-600 font-medium">Join POVGo</Link></>}
    >
      {forgot === 'email' ? (
        <form onSubmit={sendReset} className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Email</span>
            <input className={`${inputClass} mt-1`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className={primaryBtn} disabled={busy}>{busy ? 'Sending…' : 'Send reset code'}</button>
          <button type="button" onClick={() => { setForgot('off'); setError(''); }} className="block mx-auto text-sm font-bold text-gray-500 hover:underline">Back to sign in</button>
        </form>
      ) : forgot === 'code' ? (
        <EmailCode kind="recovery" email={email} onBack={() => setForgot('email')} onVerified={() => setForgot('newpw')} />
      ) : forgot === 'newpw' ? (
        <NewPassword onDone={done} />
      ) : needCode ? (
        <EmailCode email={email} onBack={() => setNeedCode(false)} onVerified={done} />
      ) : (
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Email</span>
          <input className={`${inputClass} mt-1`} type="email" value={email}
            onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Password</span>
          <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
        </label>
        <button type="button" onClick={() => { setForgot('email'); setError(''); }} className="block ml-auto text-xs font-bold text-glacier hover:underline">Forgot password?</button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className={primaryBtn} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      )}
    </AuthCard>
  );
}
