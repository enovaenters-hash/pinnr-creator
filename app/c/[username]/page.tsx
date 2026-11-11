'use client';

import { useParams } from 'next/navigation';
import FanMap from '@/components/FanMap';

/** Shareable creator map: /c/<tiktok username> — the fan map opened on that creator. */
export default function CreatorMapPage() {
  const { username } = useParams<{ username: string }>();
  const handle = decodeURIComponent(username ?? '').replace(/^@/, '').toLowerCase();
  return <FanMap initialCreator={handle} />;
}
