'use client';

import { useEffect } from 'react';

/**
 * The separate Map page is gone: the map lives on Explore (everyone's spots) and at the bottom of Following
 * (your creators' spots and your lists). Old links, including /map?focus=<video id>, land on Explore with the
 * same query so a shared spot still opens.
 */
export default function MapMoved() {
  useEffect(() => {
    window.location.replace('/' + window.location.search);
  }, []);
  return <main className="p-6 text-center text-sm text-gray-600">Taking you to Explore…</main>;
}
