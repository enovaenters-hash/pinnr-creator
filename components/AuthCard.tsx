'use client';

import { supabaseConfigured } from '@/lib/supabase';
import SiteNav from '@/components/SiteNav';

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
