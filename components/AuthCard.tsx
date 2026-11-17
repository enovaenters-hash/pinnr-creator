'use client';

import { supabaseConfigured } from '@/lib/supabase';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';

export function AuthCard({
  title, subtitle, children, footer,
}: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <>
    <SiteNav active="login" />
    <main className="flex-1 flex items-center justify-center px-4 py-12 bg-cloud">
      <div className="w-full max-w-sm">
        <div className="card p-7">
          <h1 className="text-2xl font-semibold text-ink">{title}</h1>
          <p className="text-sm text-gray-500 mt-1 mb-5">{subtitle}</p>
          {supabaseConfigured ? children : <NotConfigured />}
        </div>
        <p className="text-center text-sm text-gray-500 mt-4">{footer}</p>
      </div>
    </main>
    <SiteFooter />
    </>
  );
}

export function NotConfigured() {
  return (
    <div className="text-sm rounded-lg bg-amber-50 border border-amber-200 text-amber-900 p-3">
      Supabase isn&apos;t connected yet. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
      <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in Vercel, then redeploy.
    </div>
  );
}

export const inputClass =
  'w-full px-4 py-2.5 border-2 border-gray-200 rounded-full text-sm text-ink bg-white focus:outline-none focus:border-ice focus:ring-4 focus:ring-frost';
export const primaryBtn =
  'btn-sun w-full py-3 text-sm';

/** An on/off switch with a label and a line of help text. */
export function Switch({ on, onChange, label, hint, id }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string; id: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-cloud px-4 py-3">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-sm font-extrabold text-ink cursor-pointer">{label}</label>
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </div>
      <button id={id} type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
        className={`relative shrink-0 w-12 h-7 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-frost ${on ? 'bg-ice' : 'bg-gray-300'}`}>
        <span aria-hidden="true" className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}
