import { PIN_PATH, PLAY_PATH } from '@/lib/brand';

// White parts of the logo get a black outline so they hold up on the ice-blue bar.
const OUTLINE = '#000000';

/** POVGo Play Pin logo. `tone="onIce"` is for the ice-blue bar (white pin and "Go"). */
export default function Logo({ tone = 'onLight', className = 'h-8 w-auto' }: { tone?: 'onLight' | 'onIce'; className?: string }) {
  const onIce = tone === 'onIce';
  return (
    <svg viewBox="-2 0 218 60" className={className} role="img" aria-label="POVGo">
      <g transform="translate(2 4) scale(1.08)">
        <path d={PIN_PATH} fill={onIce ? '#ffffff' : '#7fd4f2'}
          {...(onIce ? { stroke: OUTLINE, strokeWidth: 2.6, strokeLinejoin: 'round' as const } : {})} />
        <path d={PLAY_PATH} fill={onIce ? '#7fd4f2' : '#ffffff'} />
      </g>
      <text x="60" y="44" fontFamily="var(--font-sora), Sora, sans-serif" fontSize="42" fontWeight="800" letterSpacing="-1.2">
        <tspan fill="#13293a">POV</tspan>
        <tspan fill={onIce ? '#ffffff' : '#7fd4f2'}
          {...(onIce ? { stroke: OUTLINE, strokeWidth: 2.8, strokeLinejoin: 'round' as const, paintOrder: 'stroke' } : {})}>Go</tspan>
      </text>
    </svg>
  );
}
