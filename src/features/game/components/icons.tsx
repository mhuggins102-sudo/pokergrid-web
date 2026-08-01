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
      {/* Back card: tilted, peeking out — its bottom-right corner arcs
          back and the bottom edge runs INTO the front card so the two
          read as one fan, not floating strokes. */}
      <path d="M13.2 4.15 18.9 5.65a1.6 1.6 0 0 1 1.14 1.96L17.8 15.8a1.6 1.6 0 0 1-1.96 1.14L14 16.45" />
      {/* Front card, upright. */}
      <rect x="4.5" y="5.5" width="9.5" height="14" rx="1.8" />
    </svg>
  );
}

/** Tally marks — four strokes and the counting slash. */
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
      <line x1="5" y1="5" x2="5" y2="16" />
      <line x1="9.7" y1="5" x2="9.7" y2="16" />
      <line x1="14.3" y1="5" x2="14.3" y2="16" />
      <line x1="19" y1="5" x2="19" y2="16" />
      <line x1="2.8" y1="18.5" x2="21.2" y2="9.5" />
    </svg>
  );
}
