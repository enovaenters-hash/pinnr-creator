// POVGo brand shapes: the Play Pin from the logo (48×48 box).
export const PIN_PATH = 'M24 47C24 47 5 29 5 18A19 19 0 0 1 43 18C43 29 24 47 24 47Z';
export const PLAY_PATH = 'M19.5 10.5L31.5 18L19.5 25.5Z';

export const ICE = '#7fd4f2';
export const SUN = '#ffd23f';
export const INK = '#13293a';

/** Play Pin marker as an SVG string (for Leaflet divIcons). */
export function pinSvg(size: number, fill = ICE, cut = '#ffffff', stroke = INK) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" style="display:block;overflow:visible;filter:drop-shadow(0 2px 3px rgba(19,41,58,.35))" aria-hidden="true">`
    + `<path d="${PIN_PATH}" fill="${fill}" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round"/>`
    + `<path d="${PLAY_PATH}" fill="${cut}"/></svg>`;
}
