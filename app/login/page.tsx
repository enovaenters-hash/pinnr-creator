'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { AuthCard, inputClass, primaryBtn } from '@/components/AuthCard';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    const next = new URLSearchParams(window.location.search).get('next');
    router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard');
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to manage your map."
      footer={<>New here? <Link href="/signup" className="text-blue-600 font-medium">Create an account</Link></>}
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Email</span>
          <input className={`${inputClass} mt-1`} type="email" value={email}
            onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Password</span>
          <input className={`${inputClass} mt-1`} type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className={primaryBtn} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </AuthCard>
  );
}
