'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type BottomTab = 'explore' | 'search' | 'following' | 'myspots';

const ITEMS: { key: BottomTab; label: string; href: string; icon: React.ReactNode }[] = [
  { key: 'explore', label: 'Explore', href: '/', icon: <><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" /><path d="M15.8 8.2L13.6 13.6L8.2 15.8L10.4 10.4Z" /></> },
  { key: 'search', label: 'Search', href: '/search', icon: <><circle cx="10.5" cy="10.5" r="6.3" fill="none" stroke="currentColor" strokeWidth="2.5" /><path d="M15.4 15.4L20.6 20.6" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" /></> },
  { key: 'following', label: 'Following', href: '/fan', icon: <path d="M12 20.8C4.8 15.7 3 12.4 3 9.2A4.9 4.9 0 0 1 12 6.6 4.9 4.9 0 0 1 21 9.2C21 12.4 19.2 15.7 12 20.8Z" /> },
  { key: 'myspots', label: 'My Spots', href: '/fan?view=myspots', icon: <><path d="M12 21.5C12 21.5 4.5 14.5 4.5 9.5A7.5 7.5 0 0 1 19.5 9.5C19.5 14.5 12 21.5 12 21.5Z" /><circle cx="12" cy="9.5" r="2.6" fill="#fff" /></> },
];

/**
 * The main navigation, along the bottom of every screen size: Explore · Search · Following · My Spots.
 * On the fan page the parent passes `onSelect` so Following and My Spots switch in place; elsewhere they are links.
 * Explore always goes to the top of the home page.
 */
export default function BottomNav({ active, onSelect }: { active?: BottomTab; onSelect?: (v: 'following' | 'myspots') => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-[1200] bg-white border-t border-gray-200 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] px-[max(0.25rem,env(safe-area-inset-left,0px))]">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
        {ITEMS.map((it) => {
          const cls = `grid justify-items-center gap-0.5 py-1.5 rounded-2xl text-[11px] font-extrabold leading-tight ${active === it.key ? 'bg-sun-soft text-ink' : 'text-gray-500 hover:text-ink'}`;
          const icon = <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6" aria-hidden="true">{it.icon}</svg>;
          if ((it.key === 'following' || it.key === 'myspots') && onSelect) {
            return <button key={it.key} type="button" onClick={() => onSelect(it.key as 'following' | 'myspots')} aria-current={active === it.key ? 'page' : undefined} className={cls}>{icon}{it.label}</button>;
          }
          return (
            <Link key={it.key} href={it.href} aria-current={active === it.key ? 'page' : undefined} className={cls}
              onClick={it.key === 'explore' ? (e) => {
                // Already on Explore: stay put, go back to the top of the page and drop any open spot from the address.
                if (pathname === '/') { e.preventDefault(); window.history.replaceState(null, '', '/'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
              } : undefined}>{icon}{it.label}</Link>
          );
        })}
      </div>
    </nav>
  );
}
