import { Button } from '../../design/primitives';
import { CardFace } from '../game/components/CardFace';
import { Card } from '../../game/cards';
import { DockLayout } from './settingsStore';
import styles from './DockLayoutPreview.module.css';

const DRAWN: Card = { kind: 'standard', rank: 'Q', suit: 'H' };

export const DOCK_LAYOUT_LABEL: Record<DockLayout, string> = {
  'hand-stack': 'Hand stack',
  'center-stage': 'Center stage',
  classic: 'Classic',
};

const meta = (
  <span className={styles.meta}>
    52 left · <span className={styles.peek}>Peek</span>
  </span>
);

/**
 * Inert mini-mockup of one in-game dock arrangement — shown in the
 * Settings preview sheet when a layout is picked.
 */
export function DockLayoutPreview({ layout }: { layout: DockLayout }) {
  if (layout === 'classic') {
    return (
      <div className={styles.frame}>
        <div className={styles.classicRow}>
          <div className={`${styles.card} ${styles.cardSm}`}>
            <CardFace card={DRAWN} />
          </div>
          {meta}
          <span className={styles.spacer} />
          <Button size="sm" variant="secondary">
            ♥ Swap
          </Button>
          <Button size="sm" variant="secondary">
            Discard
          </Button>
        </div>
        <Button variant="primary" className={styles.full}>
          Place
        </Button>
      </div>
    );
  }
  if (layout === 'center-stage') {
    return (
      <div className={styles.frame}>
        <div className={styles.stageRow}>
          <Button size="sm" variant="secondary" className={styles.side}>
            ♥ Swap
          </Button>
          <div className={styles.cardCol}>
            <div className={`${styles.card} ${styles.cardMd}`}>
              <CardFace card={DRAWN} />
            </div>
            {meta}
          </div>
          <Button size="sm" variant="secondary" className={styles.side}>
            Discard
          </Button>
        </div>
        <Button variant="primary" className={styles.full}>
          Place
        </Button>
      </div>
    );
  }
  return (
    <div className={styles.frame}>
      <div className={styles.handRow}>
        <div className={styles.cardCol}>
          <div className={`${styles.card} ${styles.cardLg}`}>
            <CardFace card={DRAWN} />
          </div>
          {meta}
        </div>
        <div className={styles.stack}>
          <Button variant="primary" className={styles.full}>
            Place
          </Button>
          <div className={styles.pair}>
            <Button size="sm" variant="secondary" className={styles.half}>
              ♥ Swap
            </Button>
            <Button size="sm" variant="secondary" className={styles.half}>
              Discard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
