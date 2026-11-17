'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getSupabase, supabaseConfigured } from '@/lib/supabase';

export type NavActive = 'home' | 'login' | 'admin';

const pill = 'whitespace-nowrap rounded-full px-2.5 sm:px-4 py-1.5 sm:py-2 text-[13px] sm:text-sm font-extrabold text-ink transition-colors';
const on = 'bg-white shadow-sm';
const off = 'opacity-85 hover:bg-white/40 hover:opacity-100';

/** Sign in, or your account menu with Sign out. The main navigation (Explore, Following, My Spots) lives in BottomNav. Shared by the site bar and the fan map bar. */
export default function NavLinks({ active, className = '' }: { active?: NavActive; className?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // undefined = checking, null = signed out, string = signed in (the first letter of their name or email)
  const [who, setWho] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!supabaseConfigured) { setWho(null); return; }
    const supabase = getSupabase();
    const letter = (u: { email?: string; user_metadata?: { display_name?: string } } | undefined) =>
      ((u?.user_metadata?.display_name || u?.email || '?').trim().charAt(0) || '?').toUpperCase();
    supabase.auth.getSession().then(({ data }) => setWho(data.session ? letter(data.session.user) : null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setWho(session ? letter(session.user) : null));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    setOpen(false);
    await getSupabase().auth.signOut();
    window.location.href = '/';
  }

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <nav aria-label="Main" className={`flex items-center gap-0.5 sm:gap-1.5 ${className}`}>
      {who === null ? (
        <Link href="/login" className={`${pill} ${active === 'login' ? on : 'bg-white shadow-sm'}`}>Sign in</Link>
      ) : who === undefined ? (
        <span className={`${pill} invisible`} aria-hidden="true">Sign in</span>
      ) : (
        <div ref={box} className="relative z-[1300]">
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label="Your account"
            className={`${pill} ${active === 'login' ? on : 'bg-white shadow-sm'} inline-flex items-center gap-1.5`}>
            <span aria-hidden="true" className="grid place-items-center w-5 h-5 rounded-full bg-ink text-white text-[11px] leading-none">{who}</span>
            <span aria-hidden="true" className={`text-[10px] transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
          </button>
          {open && (
            <div role="menu" className="absolute right-0 top-full mt-2 w-40 rounded-2xl bg-white p-1.5 shadow-[0_10px_30px_rgba(19,41,58,.18)] ring-1 ring-black/5">
              <button role="menuitem" type="button" onClick={signOut} className="w-full text-left rounded-xl px-3 py-2 text-ink hover:bg-frost font-extrabold text-sm">Sign out</button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
