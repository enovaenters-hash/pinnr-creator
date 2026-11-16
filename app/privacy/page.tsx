import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { CONTACT_EMAIL } from '@/lib/brand';

export const metadata: Metadata = { title: 'Privacy Policy · POVGo' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="November 16, 2026">
      <p>POVGo shows the places creators talk about in their videos on one map. This page explains what we collect, why, and the choices you have.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your email address, a password (stored securely by our login provider, never in plain text), and the name you choose to show.</li>
        <li><strong>Creator profile:</strong> your social media handle, display name and profile picture, plus the public videos you post and the places we find in them (name, address, map position).</li>
        <li><strong>Fan activity:</strong> who you follow, videos you save, your lists, and your “My Map”.</li>
        <li><strong>Location:</strong> only if you tap “Use my location”, and only in your browser to sort by distance. We don’t store it.</li>
      </ul>

      <h2>If you connect a social account</h2>
      <p>Creators can connect their TikTok account (and other platforms in future) to prove the handle is theirs. When you do, the platform shares with us your account ID, username, display name, profile picture and your public videos. We store the access tokens the platform gives us on our servers, where the website cannot read them, and use them only to confirm your handle and sync your public videos. We never post for you or see your private messages. You can disconnect at any time from your dashboard, which deletes our copy of the tokens, or remove POVGo from the app’s settings on the platform.</p>

      <h2>How we use it</h2>
      <p>To run the map and your account, show public creator pages, sync new videos, and keep POVGo secure. We don’t sell your personal information and we don’t show ads.</p>

      <h2>Who else handles data</h2>
      <p>We rely on a few providers to run the service: Supabase (database and login), Vercel (hosting), OpenStreetMap’s Nominatim (turning addresses into map positions), and the social platforms you choose to connect. Videos shown on the map are embedded from the platform they were posted on, which has its own privacy policy.</p>

      <h2>Your choices</h2>
      <ul>
        <li>Disconnect a social account any time from your dashboard.</li>
        <li>Hide any video from the map from your dashboard.</li>
        <li>Ask us to delete your account and the data tied to it.</li>
      </ul>
      {CONTACT_EMAIL ? <p>To ask a question or request deletion, email <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p> : null}

      <h2>Children</h2>
      <p>POVGo is not meant for children under 13, and we don’t knowingly collect their information.</p>

      <h2>Changes</h2>
      <p>If we change this policy, we’ll update the date above.</p>
    </LegalPage>
  );
}
