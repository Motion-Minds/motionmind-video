/**
 * MotionMind symbol (public/brand/motionmind-symbol.svg) drawn inline. On the graphite UI the graphite tile would
 * vanish, so the tile gets a hairline edge; the geometry and colours are the logo's own.
 */
export function BrandMark({ size = 38, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 256 256" role="img" aria-label="MotionMind">
      <path
        fill="#0E0F11"
        stroke="rgb(255 255 255 / 0.14)"
        strokeWidth="5"
        d="M80 24 H176 A56 56 0 0 1 232 80 V176 A56 56 0 0 1 176 232 H80 A56 56 0 0 1 24 176 V80 A56 56 0 0 1 80 24 Z"
      />
      <path
        fill="#C9F24D"
        d="M95.97 182.78 A55 55 0 0 0 122.53 159.48 L152.53 107.52 A33 33 0 0 1 161.65 97.36 A8 8 0 0 1 170.58 97.02 A20 20 0 1 0 163.87 69.88 A8 8 0 0 1 160.03 73.22 A55 55 0 0 0 133.47 96.52 L103.47 148.48 A33 33 0 0 1 94.35 158.64 A8 8 0 0 1 85.42 158.98 A20 20 0 1 0 92.13 186.12 A8 8 0 0 1 95.97 182.78 Z"
      />
    </svg>
  );
}
