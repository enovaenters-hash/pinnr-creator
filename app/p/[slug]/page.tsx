'use client';

import { useParams } from 'next/navigation';
import BusinessPage from '@/components/BusinessPage';

/** Shareable business page: /p/<place slug>, e.g. /p/thaitanic — every creator's POV of that spot in one place. */
export default function BusinessRoute() {
  const { slug } = useParams<{ slug: string }>();
  const key = decodeURIComponent(slug ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return <BusinessPage key={key} slug={key} />;
}
