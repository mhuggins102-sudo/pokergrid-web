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
 * beats via `beatDelays` (ms per row, in render order). With `onOpen`,
 * the stack is a button opening the per-card build-up sheet; the
 * score-math panel still carries the accessible line-by-line version.
 */
export function ScoreBreakdown({
  breakdown,
  beatDelays,
  onOpen,
}: {
  breakdown: ScoreBreakdownData;
  /** Fade-in delay (ms) per rendered row; omit for a static render. */
  beatDelays?: number[];
  /** Tap → the per-card score build-up sheet. */
  onOpen?: () => void;
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
  const rowSpans = rows.map((row, i) => (
    <span
      key={row.key}
      className={`${row.className} ${beatDelays ? styles.breakRowIn : ''}`}
      style={
        beatDelays
          ? ({ animationDelay: `${beatDelays[i] ?? 0}ms` } as CSSProperties)
          : undefined
      }
    >
      {row.text}
    </span>
  ));

  if (onOpen) {
    return (
      <button
        type="button"
        className={`${styles.breakdown} ${styles.breakdownBtn}`}
        aria-label="Scoring summary"
        onClick={onOpen}
      >
        {rowSpans}
      </button>
    );
  }
  return (
    <span className={styles.breakdown} aria-hidden="true">
      {rowSpans}
    </span>
  );
}
