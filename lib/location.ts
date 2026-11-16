import { CATEGORIES } from './types';

// Platform-neutral place detection: reads an address / place name out of a caption (TikTok today,
// Instagram or anything else later), builds geocoder queries, and guesses a category.

// "4435 S Rural Rd, Tempe, AZ 85282" — street number, street, city, state (+ optional ZIP)
const US_STREET = /\b\d{1,6}\s+[A-Za-z0-9.'#\- ]+?,\s*[A-Za-z.'\- ]+?,\s*[A-Z]{2}\b(?:\s+\d{5})?/;

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;

/** "MoriTeriyakiWokSushi" → "Mori Teriyaki Wok Sushi"; all-lowercase handles stay "@handle". */
function nameFromHandle(h: string): string {
  if (/[a-z][A-Z]/.test(h)) return h.replace(/[_.]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  return `@${h}`;
}

/** True when an auto-picked "name" is really a sentence from the caption. */
export function looksLikeSentence(name: string | null | undefined): boolean {
  if (!name) return false;
  if (/[“”"!?]|\.\s/.test(name) || name.split(/\s+/).length > 8 || name.length > 60) return true;
  // Two or more everyday sentence words ("After serving their community for 38 years").
  const words = name.toLowerCase().match(/[a-z’']+/g) ?? [];
  const glue = new Set(['i', 'i’m', "i'm", 'my', 'me', 'we', 'our', 'us', 'he', 'she', 'his', 'her', 'their', 'they',
    'this', 'that', 'for', 'to', 'was', 'is', 'are', 'have', 'had', 'been', 'just', 'when', 'who', 'after', 'before', 'about']);
  return words.filter((w) => glue.has(w)).length >= 2;
}

/**
 * Turn the text just before an address into a place name. Prefers what follows 📍
 * (e.g. "📍 @MoriTeriyakiWokSushi 581 W Campbell Rd…" → "Mori Teriyaki Wok Sushi").
 * Returns null when it's really a sentence (e.g. "I went to this Italian restaurant…").
 */
function placeNameFrom(before: string): string | null {
  const pin = before.lastIndexOf('📍');
  let seg = pin >= 0 ? before.slice(pin + 2) : (before.split('\n').map((l) => l.trim()).filter(Boolean).pop() ?? '');
  seg = seg.replace(EMOJI, ' ').replace(/\s+/g, ' ').replace(/[\s,:\-–|]+$/, '').replace(/^[\s,:\-–|]+/, '').trim();
  if (!seg) return null;
  const handle = seg.match(/^@([A-Za-z0-9_.]+)$/);
  if (handle) return nameFromHandle(handle[1]);
  seg = seg.replace(/^@/, '');
  if (pin < 0) seg = seg.split(/,\s/)[0].trim();
  return looksLikeSentence(seg) ? null : seg || null;
}

/**
 * Pull a location out of a caption. Handles, in order:
 *   "📍 @MoriTeriyakiWokSushi 581 W Campbell Rd Ste 127, Richardson, TX 75080"
 *   "Thaitanic Kitchen 4435 S Rural Rd, Tempe, AZ 85282 #fyp"  (name + US street address)
 *   "📍 Joe's Pizza, 7 Carmine St NYC"
 *   "Location: ..." / "Address: ..."
 * Returns null when nothing is found so the creator can fill it in by hand.
 */
export function extractLocation(caption: string): { placeName: string | null; address: string } | null {
  const street = caption.match(US_STREET);
  if (street && street.index !== undefined) {
    return { placeName: placeNameFrom(caption.slice(0, street.index)), address: street[0].trim() };
  }

  const patterns = [
    /📍\s*([^\n#]+)/u,
    /\b(?:location|address|addy)\s*[:\-–]\s*([^\n#]+)/i,
  ];
  for (const p of patterns) {
    const m = caption.match(p);
    if (m) {
      const address = m[1].replace(EMOJI, ' ').replace(/\s+/g, ' ').replace(/[|•]+$/, '').replace(/^@/, '').trim();
      if (address.length < 3) continue;
      const first = address.split(/[,|–-]/)[0].trim();
      return { placeName: looksLikeSentence(first) ? null : first, address };
    }
  }
  return null;
}

const STREET_SUFFIX = 'st|street|rd|road|blvd|boulevard|ave|avenue|pkwy|parkway|dr|drive|ln|lane|hwy|highway|way|ct|court|cir|circle|pl|place|expy|expressway|fwy|freeway|trl|trail|loop|plz|plaza|sq|square|ter|terrace|pike|tpke|row|run|pass|xing|crossing';

/** Geocoder queries to try for an address, most specific first. */
export function geocodeCandidates(address: string, placeName?: string | null): string[] {
  const out = [address];
  // "Ste 127", "Suite B", "Unit 4", "#300"
  let noUnit = address.replace(/\s*\b(?:ste|suite|unit|apt|bldg|building)\.?\s*[\w-]+|\s*#\s*[\w-]+/gi, '');
  // Bare unit numbers after the street: "6851 Virginia Pkwy 300, McKinney" → "6851 Virginia Pkwy, McKinney"
  noUnit = noUnit.replace(new RegExp(`^(\\d+\\s+[^,]*?\\b(?:${STREET_SUFFIX}))\\.?\\s+[A-Za-z]?\\d+[A-Za-z]?(?=\\s*,)`, 'i'), '$1');
  out.push(noUnit);
  out.push(noUnit.replace(/\s+\d{5}(?:-\d{4})?\s*$/, '')); // without ZIP
  if (placeName && address.toLowerCase().startsWith(placeName.toLowerCase())) {
    const rest = address.slice(placeName.length).replace(/^[\s,|–-]+/, '');
    if (/\d/.test(rest)) out.push(rest); // only street-level, never a bare city
  }
  return [...new Set(out.map((s) => s.trim()).filter(Boolean))];
}

const CATEGORY_ALIASES: Record<string, string> = {
  taco: 'tacos', burger: 'burgers', bbq: 'bbq', barbecue: 'bbq', bakery: 'bakery',
  greek: 'mediterranean', gyro: 'mediterranean', gyros: 'mediterranean', sushi: 'sushi',
  donut: 'dessert', donuts: 'dessert', icecream: 'dessert', coffee: 'cafe',
  wings: 'soulfood', chicken: 'soulfood', jerk: 'caribbean', pho: 'vietnamese',
  dimsum: 'chinese', brunch: 'brunch', cocktails: 'bar',
  // countries / cuisines used as hashtags (#korea, #china, #haitian …)
  korea: 'korean', china: 'chinese', japan: 'japanese', mexico: 'mexican', thailand: 'thai',
  vietnam: 'vietnamese', india: 'indian', italy: 'italian', greece: 'mediterranean',
  turkish: 'mediterranean', turkey: 'mediterranean', lebanese: 'mediterranean', persian: 'mediterranean',
  egyptian: 'mediterranean', haitian: 'caribbean', haiti: 'caribbean', jamaican: 'caribbean',
  jamaica: 'caribbean', dominican: 'caribbean', cuban: 'caribbean', soul: 'soulfood', cajun: 'soulfood',
  ramen: 'ramen', sushi_: 'sushi', boba: 'dessert', pastry: 'bakery', empanadas: 'bakery',
};

/** Guess a category from hashtags/words in the caption. */
export function guessCategory(caption: string): string | null {
  const words = caption.toLowerCase().match(/[a-z]+/g) ?? [];
  for (const w of words) {
    if ((CATEGORIES as readonly string[]).includes(w) && w !== 'other') return w;
    if (CATEGORY_ALIASES[w]) return CATEGORY_ALIASES[w];
  }
  return null;
}
