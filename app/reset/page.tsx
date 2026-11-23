'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase, supabaseConfigured } from '@/lib/supabase';
import { AuthCard } from '@/components/AuthCard';
import NewPassword from '@/components/NewPassword';

/** The reset link in the "forgot password" email lands here already signed in; pick a new password. */
export default function ResetPage() {
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'ready' | 'expired'>('checking');

  useEffect(() => {
    if (!supabaseConfigured) { setState('expired'); return; }
    const supabase = getSupabase();
    let done = false;
    const ok = () => { done = true; setState('ready'); };
    const { data: sub } = supabase.auth.onAuthStateChange((e, session) => {
      if (session && (e === 'PASSWORD_RECOVERY' || e === 'SIGNED_IN')) ok();
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) ok(); });
    const t = window.setTimeout(() => { if (!done) setState('expired'); }, 3000);
    return () => { window.clearTimeout(t); sub.subscription.unsubscribe(); };
  }, []);

  return (
    <AuthCard
      title="Choose a new password"
      subtitle="Pick something you'll remember. You can tap Show to check it."
      footer={<Link href="/login" className="text-blue-600 font-medium">Back to sign in</Link>}
    >
      {state === 'checking' && <p className="text-sm text-gray-500">Checking your link…</p>}
      {state === 'expired' && (
        <p className="text-sm text-gray-700">
          This reset link has expired or was already used. <Link href="/login" className="text-blue-600 font-medium">Go to sign in</Link> and tap “Forgot password?” for a new one.
        </p>
      )}
      {state === 'ready' && <NewPassword onDone={() => router.replace('/fan')} />}
    </AuthCard>
  );
}
