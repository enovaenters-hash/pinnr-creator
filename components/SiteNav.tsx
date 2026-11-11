import Link from 'next/link';
import Logo from '@/components/Logo';

type Active = 'home' | 'map' | 'creator' | 'admin';

const LINKS: { key: Active; href: string; label: string }[] = [
  { key: 'home', href: '/', label: 'Home' },
  { key: 'map', href: '/map', label: 'Fan Map' },
  { key: 'creator', href: '/dashboard', label: 'Creator Login' },
];

/** Ice-blue POVGo top bar with Home / Fan Map / Creator Login, shared by every page. */
export default function SiteNav({ active }: { active?: Active }) {
  return (
    <div className="bg-ice text-ink">
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link href="/" aria-label="POVGo home" className="shrink-0">
          <Logo tone="onIce" className="h-9 w-auto" />
        </Link>
        <nav aria-label="Main" className="flex gap-1.5 ml-auto w-full sm:w-auto">
          {LINKS.map((l) => (
            <Link key={l.key} href={l.href} aria-current={active === l.key ? 'page' : undefined}
              className={`flex-1 sm:flex-none text-center whitespace-nowrap text-sm font-extrabold px-4 py-2 rounded-full transition-colors ${
                active === l.key ? 'bg-white text-ink shadow-sm' : 'text-ink/80 hover:bg-white/40'}`}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
