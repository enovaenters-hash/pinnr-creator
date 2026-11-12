import Link from 'next/link';
import Logo from '@/components/Logo';
import NavLinks, { type NavActive } from '@/components/NavLinks';

/** Ice-blue POVGo top bar: logo and Home · Map · Login on one line, shared by every page. */
export default function SiteNav({ active }: { active?: NavActive }) {
  return (
    <div className="bg-ice text-ink relative z-[1100]">
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-2">
        <Link href="/" aria-label="POVGo home" className="shrink-0">
          <Logo tone="onIce" className="h-7 sm:h-9 w-auto" />
        </Link>
        <NavLinks active={active} className="ml-auto" />
      </div>
    </div>
  );
}
