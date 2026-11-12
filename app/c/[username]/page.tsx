'use client';

import { useParams } from 'next/navigation';
import CreatorPage from '@/components/CreatorPage';

/** Shareable creator page: /c/<tiktok username> — their Top 3, then their map. */
export default function CreatorRoute() {
  const { username } = useParams<{ username: string }>();
  const handle = decodeURIComponent(username ?? '').replace(/^@/, '').toLowerCase();
  return <CreatorPage key={handle} handle={handle} />;
}
