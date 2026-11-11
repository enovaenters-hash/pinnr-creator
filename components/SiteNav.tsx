import Link from 'next/link';

type Active = 'home' | 'map' | 'creator';

const LINKS: { key: Active; href: string; label: string }[] = [
  { key: 'home', href: '/', label: 'Home' },
  { key: 'map', href: '/map', label: 'Fan Map' },
  { key: 'creator', href: '/dashboard', label: 'Creator Login' },
];

/** Pink top bar with the same Home / Fan Map / Creator Login buttons as the fan map. */
export default function SiteNav({ active }: { active: Active }) {
  return (
    <div className="bg-[#ff2d55] text-white">
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center">📍</span>
          Pinnr
        </Link>
        <nav aria-label="Main" className="flex gap-1.5 ml-auto w-full sm:w-auto">
          {LINKS.map((l) => (
            <Link key={l.key} href={l.href} aria-current={active === l.key ? 'page' : undefined}
              className={`flex-1 sm:flex-none text-center whitespace-nowrap text-xs font-bold px-3 py-1.5 rounded-full border ${
                active === l.key ? 'bg-white/90 text-gray-900 border-transparent' : 'border-white/60 hover:bg-white/20'}`}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
