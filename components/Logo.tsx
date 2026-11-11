import { PIN_PATH, PLAY_PATH } from '@/lib/brand';

/** POVGo Play Pin logo. `tone="onIce"` is for the ice-blue bar (white pin and "Go"). */
export default function Logo({ tone = 'onLight', className = 'h-8 w-auto' }: { tone?: 'onLight' | 'onIce'; className?: string }) {
  const onIce = tone === 'onIce';
  return (
    <svg viewBox="0 0 214 60" className={className} role="img" aria-label="POVGo">
      <g transform="translate(2 4) scale(1.08)">
        <path d={PIN_PATH} fill={onIce ? '#ffffff' : '#7fd4f2'} />
        <path d={PLAY_PATH} fill={onIce ? '#7fd4f2' : '#ffffff'} />
      </g>
      <text x="60" y="44" fontFamily="var(--font-sora), Sora, sans-serif" fontSize="42" fontWeight="800" letterSpacing="-1.2">
        <tspan fill="#13293a">POV</tspan><tspan fill={onIce ? '#ffffff' : '#7fd4f2'}>Go</tspan>
      </text>
    </svg>
  );
}
