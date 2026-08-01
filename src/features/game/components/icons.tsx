/* Tiny stroke icons for the game chrome, drawn to the app's icon
   grammar: 24 viewBox, currentColor stroke, fill none, aria-hidden,
   with the accessible name on the wrapping button. SVG over a font
   glyph for the Chevron.tsx reason — glyphs render at wildly
   different sizes across platforms; a stroke is pixel-identical. */

/** A small fan of playing cards — the hand-values reference. */
export function HandsIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* Back card: top + right edge peeking out, tilted. */}
      <path d="M13.5 4.2 18.9 5.65a1.6 1.6 0 0 1 1.14 1.96L17.5 16.5" />
      {/* Front card, upright. */}
      <rect x="4.5" y="5.5" width="9.5" height="14" rx="1.8" />
    </svg>
  );
}

/** A miniature scoring ledger — header band over two total columns. */
export function ScoringIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="4.5" width="16" height="15" rx="1.8" />
      <line x1="4" y1="9.75" x2="20" y2="9.75" />
      <line x1="12" y1="9.75" x2="12" y2="19.5" />
    </svg>
  );
}
