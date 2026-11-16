import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';

/** Plain page frame for the Privacy Policy and Terms of Service. */
export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      <main className="flex-1 bg-cloud text-ink">
        <article className="max-w-2xl mx-auto px-4 py-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-7 [&_h2]:mb-2 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-gray-700 [&_p]:mb-3 [&_ul]:text-sm [&_ul]:text-gray-700 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:space-y-1">
          <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
          <p className="!text-xs !text-gray-500 mt-1">Last updated {updated}</p>
          {children}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
