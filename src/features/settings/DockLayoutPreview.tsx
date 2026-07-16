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
  // The stored key predates the rename — the phone two-column view
  // shows as "Split" so it can't be confused with the desktop tier.
  desktop: 'Split',
};

const meta = (
  <span className={styles.meta}>
    52 left · <span className={styles.peek}>Peek</span>
  </span>
);

// Classic keeps the game's two-line meta column beside the card (the
// stacked docks run it under the card as one line).
const metaCol = (
  <span className={`${styles.meta} ${styles.metaCol}`}>
    <span>52 left</span>
    <span className={styles.peek}>Peek</span>
  </span>
);

// The compact icon-only ↺ every dock carries (GameScreen's .dockUndo).
const undoBtn = (
  <Button size="sm" variant="secondary" className={styles.iconBtn} aria-hidden>
    ↺
  </Button>
);

/**
 * Inert mini-mockup of one in-game dock arrangement — shown in the
 * Settings display preview. Mirrors the CURRENT docks: every stacked
 * arrangement carries the icon-only ↺, Center stage flanks the card
 * with two stacked buttons per side (no full-width commit row), and
 * the "Desktop" view pairs the bonus column with a 2×2 action grid.
 * With `desk`, previews the ≥1024 desk dock instead: 'center-stage'
 * = the hero arrangement, anything else = the compact card-beside-
 * buttons variant (the desktop Settings picker's "Compact").
 */
export function DockLayoutPreview({
  layout,
  desk = false,
}: {
  layout: DockLayout;
  desk?: boolean;
}) {
  // The desk dock's action stack (both variants): commit, the amber
  // suit perk, then Discard + the icon ↺ two-up.
  const deskStack = (
    <>
      <Button variant="primary" className={styles.full}>
        Place
      </Button>
      <Button
        size="sm"
        variant="secondary"
        className={`${styles.full} ${styles.perkBtn}`}
      >
        ♥ Swap
      </Button>
      <div className={styles.pair}>
        <Button size="sm" variant="secondary" className={styles.half}>
          Discard
        </Button>
        {undoBtn}
      </div>
    </>
  );
  if (desk) {
    return layout === 'center-stage' ? (
      <div className={styles.frame}>
        <div className={styles.deskStage}>
          <div className={styles.cardCol}>
            <div className={`${styles.card} ${styles.cardMd}`}>
              <CardFace card={DRAWN} />
            </div>
            {meta}
          </div>
          {deskStack}
        </div>
      </div>
    ) : (
      <div className={styles.frame}>
        <div className={styles.handRow}>
          <div className={styles.cardCol}>
            <div className={`${styles.card} ${styles.cardSm}`}>
              <CardFace card={DRAWN} />
            </div>
            {meta}
          </div>
          <div className={styles.stack}>{deskStack}</div>
        </div>
      </div>
    );
  }
  if (layout === 'classic') {
    return (
      <div className={styles.frame}>
        <div className={styles.classicRow}>
          <div className={`${styles.card} ${styles.cardSm}`}>
            <CardFace card={DRAWN} />
          </div>
          {metaCol}
          <span className={styles.spacer} />
          <Button
            size="sm"
            variant="secondary"
            className={styles.perkBtn}
          >
            ♥ Swap
          </Button>
          <Button size="sm" variant="secondary">
            Discard
          </Button>
          {undoBtn}
        </div>
        <Button variant="primary" className={styles.full}>
          Place
        </Button>
      </div>
    );
  }
  if (layout === 'desktop') {
    // Two columns: held bonus cards on the left, the deck (meta beside
    // the card) + the 2×2 action grid on the right.
    return (
      <div className={`${styles.frame} ${styles.desktopFrame}`}>
        <div className={styles.desktopBonus}>
          <span className={styles.desktopPanelTitle}>Bonus</span>
          <span className={styles.desktopChip} />
          <span className={styles.desktopChip} />
        </div>
        <div className={styles.desktopDock}>
          <div className={styles.wellRow}>
            <div className={`${styles.card} ${styles.cardSm}`}>
              <CardFace card={DRAWN} />
            </div>
            <span className={`${styles.meta} ${styles.metaCol}`}>
              <span>Deck · 52</span>
              <span className={styles.peek}>Peek</span>
            </span>
          </div>
          <div className={styles.grid2}>
            <Button size="sm" variant="primary">
              Place
            </Button>
            <Button size="sm" variant="secondary" className={styles.iconBtn}>
              🗑
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className={styles.perkBtn}
            >
              ♥ Swap
            </Button>
            <Button size="sm" variant="secondary" className={styles.iconBtn}>
              ↺
            </Button>
          </div>
        </div>
      </div>
    );
  }
  if (layout === 'center-stage') {
    // The card front and center with two stacked buttons flanking it:
    // Discard + ↺ left, Place + the suit perk right. No commit row.
    return (
      <div className={styles.frame}>
        <div className={styles.stageRow}>
          <div className={styles.stageSide}>
            <Button size="sm" variant="secondary" className={styles.full}>
              Discard
            </Button>
            <Button size="sm" variant="secondary" className={styles.full}>
              Undo
            </Button>
          </div>
          <div className={styles.cardCol}>
            <div className={`${styles.card} ${styles.cardMd}`}>
              <CardFace card={DRAWN} />
            </div>
            {meta}
          </div>
          <div className={styles.stageSide}>
            <Button size="sm" variant="primary" className={styles.full}>
              Place
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className={`${styles.full} ${styles.perkBtn}`}
            >
              ♥ Swap
            </Button>
          </div>
        </div>
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
            <Button
              size="sm"
              variant="secondary"
              className={`${styles.half} ${styles.perkBtn}`}
            >
              ♥ Swap
            </Button>
            <Button size="sm" variant="secondary" className={styles.half}>
              Discard
            </Button>
            {undoBtn}
          </div>
        </div>
      </div>
    </div>
  );
}
