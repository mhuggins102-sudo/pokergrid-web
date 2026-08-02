export interface ArrowProps {
  /** Rendered box in px — match the surrounding font-size. */
  size?: number;
  className?: string;
}

/* Inline SVG arrows for link/CTA affordances. The Unicode glyphs
   (→ / ← / ▸) render at wildly different optical sizes across
   platforms — tiny on iOS — same rationale as Chevron.tsx. Color
   follows currentColor; the slight negative vertical-align seats the
   arrow on the text baseline like a glyph would. */

const BASELINE = { verticalAlign: '-0.11em' } as const;

export function ArrowRight({ size = 14, className }: ArrowProps) {
  return (
    <svg
      className={className}
      style={BASELINE}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3.5 10h12M11 4.5l5.5 5.5-5.5 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArrowLeft({ size = 14, className }: ArrowProps) {
  return (
    <svg
      className={className}
      style={BASELINE}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M16.5 10h-12M9 4.5L3.5 10 9 15.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Filled play-triangle — the "Start ▸" affordance. */
export function TriangleRight({ size = 12, className }: ArrowProps) {
  return (
    <svg
      className={className}
      style={BASELINE}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 3.8v12.4L16.2 10z" fill="currentColor" />
    </svg>
  );
}
