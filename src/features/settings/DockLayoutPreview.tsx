import { CSSProperties } from 'react';
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
      {/* Place + the amber perk are the two tall primary actions (equal
          height, as in the real desk dock); Discard + ↺ ride below as the
          slim secondary pair. */}
      <Button variant="primary" className={styles.full}>
        Place
      </Button>
      <Button
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
            {/* Larger deck card to match the real desk dock's proportions
                (the card reads about as tall as the two primary actions). */}
            <div className={`${styles.card} ${styles.cardMd}`}>
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
    // Two equal columns, as in game: the bonus panel's fixed 3-slot
    // fill on the left (held entries + a dotted placeholder,
    // DesktopBonusPanel's dock column at mini scale), the deck (meta
    // beside the card) + the 2×2 action grid on the right.
    return (
      <div className={`${styles.frame} ${styles.desktopFrame}`}>
        <div className={styles.desktopBonus}>
          <span
            className={styles.slotCard}
            style={{ '--tone': 'var(--warn)' } as CSSProperties}
          >
            <b className={styles.slotTitle}>Straight</b>
            <span className={styles.slotMult}>×2 (each)</span>
            <i className={styles.slotVal}>+12</i>
          </span>
          <span
            className={styles.slotCard}
            style={{ '--tone': 'var(--warn)' } as CSSProperties}
          >
            <b className={styles.slotTitle}>Col 3</b>
            <span className={styles.slotMult}>×2</span>
          </span>
          <span className={styles.slotEmpty}>empty</span>
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
              {/* The game's trash glyph (GameScreen's Discard icon). */}
              <svg
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 6h18" />
                <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                <path d="M6 6v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
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
