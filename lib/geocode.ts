export interface GeoResult {
  lat: number;
  lng: number;
  displayName: string;
}

/** Free geocoding via OpenStreetMap Nominatim (max ~1 request/second). */
export async function geocode(query: string): Promise<GeoResult | null> {
  const q = query.trim();
  if (!q) return null;
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Pinnr/0.2 (creator maps)' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (!rows.length) return null;
    return { lat: parseFloat(rows[0].lat), lng: parseFloat(rows[0].lon), displayName: rows[0].display_name };
  } catch {
    return null;
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
