'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { AuthCard, inputClass, primaryBtn } from '@/components/AuthCard';

export default function SignupPage() {
  const router = useRouter();
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checkEmail, setCheckEmail] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const username = handle.replace(/^@/, '').trim().toLowerCase();
    if (!/^[a-z0-9._]{2,24}$/.test(username)) {
      setError('Enter a valid TikTok username (letters, numbers, . and _).');
      return;
    }
    setBusy(true);
    const supabase = getSupabase();

    const { data: taken } = await supabase
      .from('creators').select('id').eq('tiktok_username', username).maybeSingle();
    if (taken) {
      setBusy(false);
      setError(`@${username} already has a Pinnr account. Try signing in.`);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { tiktok_username: username, display_name: username } },
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    if (data.session) router.replace('/dashboard');
    else setCheckEmail(true);
  }

  return (
    <AuthCard
      title="Create your creator map"
      subtitle="Sign up, sync your TikToks, and your spots land on the map."
      footer={<>Already have an account? <Link href="/login" className="text-blue-600 font-medium">Sign in</Link></>}
    >
      {checkEmail ? (
        <p className="text-sm text-gray-700">
          Check <strong>{email}</strong> for a confirmation link, then come back and sign in.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">TikTok username</span>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">@</span>
              <input className={`${inputClass} pl-7`} value={handle} onChange={(e) => setHandle(e.target.value)}
                placeholder="samspov_1" autoCapitalize="none" autoCorrect="off" required />
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Email</span>
            <input className={`${inputClass} mt-1`} type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Password</span>
            <input className={`${inputClass} mt-1`} type="password" value={password} minLength={6}
              onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className={primaryBtn} disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        </form>
      )}
    </AuthCard>
  );
}
