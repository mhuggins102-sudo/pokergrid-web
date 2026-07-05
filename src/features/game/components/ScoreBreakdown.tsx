import { CSSProperties } from 'react';
import { ScoreBreakdownData } from '../scoreBreakdown';
import styles from './ResultView.module.css';

// Multiplier text matches the score-math panel's formatting.
const multText = (b: ScoreBreakdownData): string =>
  `×${b.gridMultiplier.toFixed(2)}${b.gridFlat !== 0 ? ` +${b.gridFlat}` : ''}`;

/**
 * The hero's top-left score decomposition: base (green), +N from gold
 * cards, ×N from purple cards — only the rows that apply; nothing at
 * all when neither factor did. With `animate`, rows land on the tally's
 * beats via `beatDelays` (ms per row, in render order); the score-math
 * panel carries the accessible version, so this is decorative.
 */
export function ScoreBreakdown({
  breakdown,
  beatDelays,
}: {
  breakdown: ScoreBreakdownData;
  /** Fade-in delay (ms) per rendered row; omit for a static render. */
  beatDelays?: number[];
}) {
  const { base, goldAdd, hasGold, hasPurple } = breakdown;
  if (!hasGold && !hasPurple) return null;
  const rows: { key: string; className: string; text: string }[] = [
    { key: 'base', className: styles.breakBase, text: String(base) },
  ];
  if (hasGold) {
    rows.push({
      key: 'gold',
      className: styles.breakGold,
      text: `+${goldAdd}`,
    });
  }
  if (hasPurple) {
    rows.push({
      key: 'purple',
      className: styles.breakPurple,
      text: multText(breakdown),
    });
  }
  return (
    <span className={styles.breakdown} aria-hidden="true">
      {rows.map((row, i) => (
        <span
          key={row.key}
          className={`${row.className} ${
            beatDelays ? styles.breakRowIn : ''
          }`}
          style={
            beatDelays
              ? ({ animationDelay: `${beatDelays[i] ?? 0}ms` } as CSSProperties)
              : undefined
          }
        >
          {row.text}
        </span>
      ))}
    </span>
  );
}
