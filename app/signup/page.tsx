'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { AuthCard, PasswordField, Switch, inputClass, primaryBtn } from '@/components/AuthCard';
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
  const [referral, setReferral] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setCreator(q.get('as') === 'creator');
    const ref = (q.get('ref') ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 20);
    if (ref) setReferral(ref);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const supabase = getSupabase();
    const display = name.trim().slice(0, 40);
    let meta: Record<string, string>;
    const code = referral.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,20}$/.test(code)) { setError('Enter the referral code from the creator who invited you.'); return; }
    // Friendly check first. If the check isn't set up yet we carry on and let the database decide.
    const { data: okCode, error: codeErr } = await supabase.rpc('check_referral_code', { p_code: code });
    if (!codeErr && okCode === false) { setError('That referral code isn’t valid. Check it with the person who invited you.'); return; }

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
      meta = { tiktok_username: username, display_name: display || username, referral_code: code };
    } else {
      if (!display) { setError('Tell us what to call you.'); return; }
      meta = { display_name: display, referral_code: code };
      setBusy(true);
    }

    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: meta } });
    setBusy(false);
    if (error) {
      setError(/database error/i.test(error.message) ? 'Couldn’t create your account. Double-check your referral code and try again.' : error.message);
      return;
    }
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
            <PasswordField id="signup-password" value={password} onChange={setPassword} autoComplete="new-password" minLength={6} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Referral code</span>
            <input id="signup-referral" className={`${inputClass} mt-1 uppercase tracking-wide`} value={referral}
              onChange={(e) => setReferral(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
              placeholder="From the creator who invited you" autoCapitalize="characters" autoCorrect="off" maxLength={20} required />
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
