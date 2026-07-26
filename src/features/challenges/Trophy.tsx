import { TrophyKind } from '../../lib/stats';

// Fixed metals (not theme tokens): gold/silver/bronze must read as
// medals in both light and dark themes, like real trophy hardware.
const TROPHY_FILL: Record<TrophyKind, string> = {
  gold: '#d4a017',
  silver: '#9aa0a8',
  bronze: '#b0713a',
};

export const TROPHY_LABEL: Record<TrophyKind, string> = {
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
};

/** Flat trophy glyph tinted by metal — the Challenges page's
 *  per-challenge award and the result popup's earned-trophy callout. */
export function Trophy({
  kind,
  size = 20,
  className,
}: {
  kind: TrophyKind;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`${TROPHY_LABEL[kind]} trophy`}
      fill={TROPHY_FILL[kind]}
    >
      {/* Cup with side handles, stem, and base. */}
      <path d="M7 2h10v2h4v3.5c0 2.9-2.1 5.1-4.8 5.4a6.2 6.2 0 0 1-3.2 2.9V18h3.5v2.5H7.5V18H11v-2.2a6.2 6.2 0 0 1-3.2-2.9C5.1 12.6 3 10.4 3 7.5V4h4V2Zm-2 4v1.5c0 1.4 1 2.7 2.4 3.2A12.9 12.9 0 0 1 7 7.5V6H5Zm14 0h-2v1.5c0 1.2-.1 2.3-.4 3.2C18 10.2 19 8.9 19 7.5V6Z" />
    </svg>
  );
}
