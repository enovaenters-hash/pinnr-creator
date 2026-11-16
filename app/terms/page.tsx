import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { CONTACT_EMAIL } from '@/lib/brand';

export const metadata: Metadata = { title: 'Terms of Service · POVGo' };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="November 16, 2026">
      <p>By using POVGo you agree to these terms. If you don’t agree, please don’t use the service.</p>

      <h2>What POVGo is</h2>
      <p>POVGo is a map of places that creators feature in their social videos. Creators sync their public videos so the places can appear on the map, and fans can follow creators, save videos and build their own lists and maps.</p>

      <h2>Your account</h2>
      <p>Keep your login details safe and give us accurate information. Creators should only claim a handle that belongs to them. We may remove accounts that impersonate others or break these terms.</p>

      <h2>Content</h2>
      <p>Videos belong to the creators who made them and stay on the platform they were posted on; POVGo only links to and embeds them. By syncing your videos you confirm they’re yours to share and allow us to show them, with their place details, on POVGo. You can hide a video or leave at any time.</p>

      <h2>Don’t misuse the service</h2>
      <ul>
        <li>No spam, fake accounts, or attempts to break or overload the service.</li>
        <li>No unlawful, hateful or misleading content, and nothing that infringes someone else’s rights.</li>
        <li>No scraping POVGo or using it to harass anyone.</li>
      </ul>

      <h2>Places and directions</h2>
      <p>Place names, addresses and map positions come from creators and automated lookups, so they can be wrong or out of date. Check a place’s hours and details before you go. POVGo isn’t responsible for what happens at the places featured.</p>

      <h2>Third-party platforms</h2>
      <p>If you connect a social account, your use of that platform is also covered by its own terms. POVGo is not affiliated with or endorsed by TikTok or any other platform.</p>

      <h2>No guarantees</h2>
      <p>POVGo is provided “as is”. We do our best to keep it running but can’t promise it will always be available or error-free, and to the extent the law allows we aren’t liable for losses arising from its use.</p>

      <h2>Changes</h2>
      <p>We may update these terms, and will change the date above when we do. Continuing to use POVGo means you accept the update.</p>
      {CONTACT_EMAIL ? <p>Questions? Email <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p> : null}
    </LegalPage>
  );
}
