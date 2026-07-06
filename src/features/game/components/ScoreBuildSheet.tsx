import { Sheet } from '../../../design/primitives';
import { ScoreBuildData } from '../scoreBreakdown';
import styles from './ScoreBuildSheet.module.css';

/**
 * The corner breakdown expanded per card — opened by tapping the
 * green/gold/purple stack on the result hero. Reads top to bottom the
 * way the tally plays: the pure-poker lines total (green), each gold
 * card's added points, the green+gold subtotal, each fired purple
 * card's multiplier / flat, and the final score.
 */
export function ScoreBuildSheet({
  open,
  onClose,
  build,
}: {
  open: boolean;
  onClose: () => void;
  build: ScoreBuildData;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Scoring summary">
      <div className={styles.rows}>
        <div className={styles.row}>
          <span>Lines total</span>
          <span className={styles.green}>{build.base}</span>
        </div>
        {build.golds.map(({ card, add }, i) => (
          <div key={`${card.id}-${i}`} className={styles.row}>
            <span className={styles.nameGold}>{card.title}</span>
            <span className={styles.gold}>
              {add >= 0 ? '+' : ''}
              {add}
            </span>
          </div>
        ))}
        {build.golds.length > 0 && (
          <div className={`${styles.row} ${styles.subtotal}`}>
            <span>Subtotal</span>
            <span className={styles.gold}>{build.subtotal}</span>
          </div>
        )}
        {build.purples.map(({ card, multiplier, flat }, i) => (
          <div key={`${card.id}-${i}`} className={styles.row}>
            <span className={styles.namePurple}>{card.title}</span>
            <span className={styles.purple}>
              {multiplier !== 1 ? `×${multiplier.toFixed(2)}` : ''}
              {multiplier !== 1 && flat !== 0 ? ' ' : ''}
              {flat !== 0 ? `+${flat}` : ''}
            </span>
          </div>
        ))}
        <div className={`${styles.row} ${styles.total}`}>
          <span>Final score</span>
          <span>{build.total}</span>
        </div>
      </div>
    </Sheet>
  );
}
