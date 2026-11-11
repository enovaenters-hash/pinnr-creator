'use client';

import { supabaseConfigured } from '@/lib/supabase';
import SiteNav from '@/components/SiteNav';

export function AuthCard({
  title, subtitle, children, footer,
}: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <>
    <SiteNav active="creator" />
    <main className="flex-1 flex items-center justify-center px-4 py-12 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
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
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500';
export const primaryBtn =
  'w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:bg-gray-400';
