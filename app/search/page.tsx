'use client';

import dynamic from 'next/dynamic';
import BottomNav from '@/components/BottomNav';

const FanMap = dynamic(() => import('@/components/FanMap'), { ssr: false });

/** Search tab: the full map of every spot, the category chips, and a scrolling list of 15 places at a time. */
export default function SearchPage() {
  return (
    <>
      <FanMap search />
      <BottomNav active="search" />
    </>
  );
}
