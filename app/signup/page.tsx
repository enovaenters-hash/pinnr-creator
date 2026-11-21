'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { AuthCard, Switch, inputClass, primaryBtn } from '@/components/AuthCard';
import EmailCode from '@/components/EmailCode';

/**
 * One sign-up for everyone. "I'm a creator" is a switch that reveals the TikTok username field
 * (/signup?as=creator starts with it on). Anyone can also flip it on later from My Spots.
 */
export default function SignupPage() {
  const router = useRouter();
  const [creator, setCreator] = useState(false);
  const [handle, setHandle] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    setCreator(new URLSearchParams(window.location.search).get('as') === 'creator');
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const supabase = getSupabase();
    const display = name.trim().slice(0, 40);
    let meta: Record<string, string>;

    if (creator) {
      const username = handle.replace(/^@/, '').trim().toLowerCase();
      if (!/^[a-z0-9._]{2,24}$/.test(username)) {
        setError('Enter a valid TikTok username (letters, numbers, . and _).');
        return;
      }
      setBusy(true);
      const { data: taken } = await supabase
        .from('creators').select('id').eq('tiktok_username', username).maybeSingle();
      if (taken) {
        setBusy(false);
        setError(`@${username} already has a POVGo account. Try signing in.`);
        return;
      }
      meta = { tiktok_username: username, display_name: display || username };
    } else {
      if (!display) { setError('Tell us what to call you.'); return; }
      meta = { display_name: display };
      setBusy(true);
    }

    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: meta } });
    setBusy(false);
    if (error) { setError(error.message); return; }
    if (data.session) router.replace(creator ? '/fan?view=myspots' : '/fan');
    else setCheckEmail(true);
  }

  return (
    <AuthCard
      title="Join POVGo"
      subtitle="Follow creators, save places and build your own map. Post your own spots too if you like."
      footer={<>Already have an account? <Link href="/login" className="text-blue-600 font-medium">Sign in</Link></>}
    >
      {checkEmail ? (
        <EmailCode email={email} onBack={() => setCheckEmail(false)}
          onVerified={() => router.replace(creator ? '/fan?view=myspots' : '/fan')} />
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Your name</span>
            <input id="signup-name" className={`${inputClass} mt-1`} value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Maya" autoComplete="given-name" maxLength={40} required={!creator} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Email</span>
            <input id="signup-email" className={`${inputClass} mt-1`} type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Password</span>
            <input id="signup-password" className={`${inputClass} mt-1`} type="password" value={password} minLength={6}
              onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
          </label>
          <Switch id="signup-creator" on={creator} onChange={setCreator} label="I’m a creator" hint="Your TikTok spots go on the map." />
          {creator && (
            <label className="block">
              <span className="text-xs font-medium text-gray-600">TikTok username</span>
              <div className="relative mt-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">@</span>
                <input id="signup-handle" className={`${inputClass} pl-8`} value={handle} onChange={(e) => setHandle(e.target.value)}
                  placeholder="samspov_1" autoCapitalize="none" autoCorrect="off" required />
              </div>
            </label>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className={primaryBtn} disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        </form>
      )}
    </AuthCard>
  );
}
