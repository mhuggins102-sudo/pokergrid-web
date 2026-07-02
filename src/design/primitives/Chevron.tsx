export interface ChevronProps {
  /** Point direction before any CSS rotation is applied. */
  direction?: 'down' | 'right';
  /** Rendered box in px. */
  size?: number;
  className?: string;
}

/**
 * Inline SVG disclosure chevron. Font glyphs (▾ / ▸ — the Unicode
 * "SMALL triangle" codepoints) render at wildly different sizes across
 * platforms (tiny on iOS); an SVG stroke is pixel-identical everywhere.
 * Color follows `currentColor`; rotate it via a CSS transform on the
 * element like any other glyph.
 */
export function Chevron({
  direction = 'down',
  size = 20,
  className,
}: ChevronProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={direction === 'down' ? 'M5 7.5l5 5 5-5' : 'M7.5 5l5 5-5 5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
