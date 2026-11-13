'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { AuthCard, inputClass, primaryBtn } from '@/components/AuthCard';

/** Sign up as a creator (TikTok username) or, with /signup?as=fan, as a fan (just a name). */
export default function SignupPage() {
  const router = useRouter();
  const [fan, setFan] = useState(false);
  const [handle, setHandle] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    setFan(new URLSearchParams(window.location.search).get('as') === 'fan');
  }, []);

  function switchTo(asFan: boolean) {
    setFan(asFan);
    setError('');
    window.history.replaceState(null, '', asFan ? '/signup?as=fan' : '/signup');
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const supabase = getSupabase();
    let meta: Record<string, string>;

    if (fan) {
      const display = name.trim().slice(0, 40);
      if (!display) { setError('Tell us what to call you.'); return; }
      meta = { display_name: display };
      setBusy(true);
    } else {
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
      meta = { tiktok_username: username, display_name: username };
    }

    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: meta } });
    setBusy(false);
    if (error) { setError(error.message); return; }
    if (data.session) router.replace(fan ? '/fan' : '/dashboard');
    else setCheckEmail(true);
  }

  return (
    <AuthCard
      title={fan ? 'Create your fan account' : 'Create your creator map'}
      subtitle={fan
        ? 'Follow creators, save videos and build your own map.'
        : 'Sign up, sync your TikToks, and your spots land on the map.'}
      footer={<>Already have an account? <Link href={fan ? '/login?next=/fan' : '/login'} className="text-blue-600 font-medium">Sign in</Link></>}
    >
      {checkEmail ? (
        <p className="text-sm text-gray-700">
          Check <strong>{email}</strong> for a confirmation link, then come back and sign in.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-cloud text-sm font-extrabold" role="group" aria-label="Account type">
            <button type="button" onClick={() => switchTo(true)} aria-pressed={fan}
              className={`py-1.5 rounded-full ${fan ? 'bg-white shadow-sm text-ink' : 'text-gray-500'}`}>Fan</button>
            <button type="button" onClick={() => switchTo(false)} aria-pressed={!fan}
              className={`py-1.5 rounded-full ${!fan ? 'bg-white shadow-sm text-ink' : 'text-gray-500'}`}>Creator</button>
          </div>
          {fan ? (
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Your name</span>
              <input id="signup-name" className={`${inputClass} mt-1`} value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Maya" autoComplete="given-name" maxLength={40} required />
            </label>
          ) : (
            <label className="block">
              <span className="text-xs font-medium text-gray-600">TikTok username</span>
              <div className="relative mt-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">@</span>
                <input id="signup-handle" className={`${inputClass} pl-8`} value={handle} onChange={(e) => setHandle(e.target.value)}
                  placeholder="samspov_1" autoCapitalize="none" autoCorrect="off" required />
              </div>
            </label>
          )}
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
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className={primaryBtn} disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        </form>
      )}
    </AuthCard>
  );
}
