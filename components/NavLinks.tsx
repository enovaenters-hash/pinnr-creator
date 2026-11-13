'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export type NavActive = 'home' | 'map' | 'login' | 'admin';

const pill = 'whitespace-nowrap rounded-full px-2.5 sm:px-4 py-1.5 sm:py-2 text-[13px] sm:text-sm font-extrabold text-ink transition-colors';
const on = 'bg-white shadow-sm';
const off = 'opacity-85 hover:bg-white/40 hover:opacity-100';

/** Home · Map · Login ▾ (Fan / Creator). Shared by the site bar and the fan map bar. */
export default function NavLinks({ active, className = '' }: { active?: NavActive; className?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

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
      <Link href="/" aria-current={active === 'home' ? 'page' : undefined} className={`${pill} ${active === 'home' ? on : off}`}>Home</Link>
      <Link href="/map" aria-current={active === 'map' ? 'page' : undefined} className={`${pill} ${active === 'map' ? on : off}`}>Map</Link>
      <div ref={box} className="relative z-[1300]">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu"
          className={`${pill} ${active === 'login' ? on : off} inline-flex items-center gap-1`}>
          Login <span aria-hidden="true" className={`text-[10px] transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
        </button>
        {open && (
          <div role="menu" className="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-white p-1.5 shadow-[0_10px_30px_rgba(19,41,58,.18)] ring-1 ring-black/5">
            <Link role="menuitem" href="/fan" onClick={() => setOpen(false)}
              className="flex flex-col rounded-xl px-3 py-2 text-ink hover:bg-frost">
              <span className="font-extrabold text-sm">Fan</span>
              <span className="text-xs font-semibold text-gray-500">Your feed, videos, lists and map</span>
            </Link>
            <Link role="menuitem" href="/dashboard" onClick={() => setOpen(false)}
              className="flex flex-col rounded-xl px-3 py-2 text-ink hover:bg-frost">
              <span className="font-extrabold text-sm">Creator</span>
              <span className="text-xs font-semibold text-gray-500">Manage your map</span>
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
