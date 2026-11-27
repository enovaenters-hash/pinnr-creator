'use client';

import { useParams } from 'next/navigation';
import PreviewMap from '@/components/PreviewMap';

/** Creator preview map: /m/<tiktok username>. Built in Admin > Creator Maps and shared by link only. */
export default function PreviewMapRoute() {
  const { handle } = useParams<{ handle: string }>();
  const h = decodeURIComponent(handle ?? '').replace(/^@/, '').toLowerCase();
  return <PreviewMap key={h} handle={h} />;
}
