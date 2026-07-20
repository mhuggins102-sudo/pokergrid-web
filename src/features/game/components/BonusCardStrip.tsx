import { CSSProperties, useState } from 'react';
import {
  BonusCard,
  isPlaceholder,
  isSpecialCard,
  isSpentSlot,
} from '../../../game/bonusCards';
import { categoryIconStyle, styleFor } from '../../../lib/bonusCardCategory';
import { Button, Sheet } from '../../../design/primitives';
import { useSettingsStore } from '../../settings/settingsStore';
import styles from './BonusCardStrip.module.css';

export function BonusChip({
  card,
  onClick,
  value,
  compact,
  hideEach,
}: {
  card: BonusCard;
  onClick?: () => void;
  /** Optional resolved contribution (Shapley points). */
  value?: number;
  /** Slim corner badge (no " pts" suffix) for the in-game row strip. */
  compact?: boolean;
  /** Drop the "(each)" suffix from the mult — the narrow end-game cells
   *  can't fit it next to the contribution. */
  hideEach?: boolean;
}) {
  const cat = styleFor(card);
  // Colorblind assist: the chip's category is otherwise color-only
  // (border tone) — the glyph is the non-color cue.
  const assist = useSettingsStore(s => s.colorBlindAssist);
  const dimmed = card.used || isPlaceholder(card);
  const multText = hideEach
    ? card.mult.replace(/\s*\(each\)\s*$/i, '')
    : card.mult;
  return (
    <button
      type="button"
      className={[styles.chip, dimmed ? styles.chipDimmed : null]
        .filter(Boolean)
        .join(' ')}
      style={{ '--chip-tone': cat.borderColor } as CSSProperties}
      onClick={onClick}
      aria-label={`Bonus card: ${card.name}${card.used ? ' (used)' : ''}${
        value !== undefined ? `, contributing ${value} points` : ''
      }`}
    >
      <span className={styles.chipTitle}>
        {assist && (
          <>
            <span
              style={{ color: cat.iconColor, ...categoryIconStyle(cat) }}
              aria-hidden="true"
            >
              {cat.icon}
            </span>{' '}
          </>
        )}
        {card.title}
        {card.used ? ' ✓' : ''}
      </span>
      <span className={styles.chipMult}>{multText}</span>
      {value !== undefined && (
        <span className={styles.chipValue}>
          {value >= 0 ? '+' : ''}
          {value}
          {compact ? '' : ' pts'}
        </span>
      )}
    </button>
  );
}

export interface BonusCardStripProps {
  cards: BonusCard[];
  bonusDeckSize?: number;
  /** Shapley contributions aligned with `cards`; entries left undefined
   *  render no value. */
  values?: (number | undefined)[];
  title?: string;
  /**
   * 'panel' (default): a titled card list for the desktop side column.
   * 'row': a slim three-slot band for mobile — always renders all three
   * hand slots (filled or dashed-empty) so held cards stay on screen
   * and the cap is legible without any scrolling.
   */
  layout?: 'panel' | 'row';
  /**
   * Mixed Bag slot pick: when set, tapping a chip reports its slot
   * index instead of opening the detail sheet.
   */
  onSlotTap?: (slot: number) => void;
  /**
   * Mixed Bag under no-swap rules: a live card locks its slot, so the
   * slot pick falls through to the detail sheet for it (mirrors the
   * engine's slotDrawable gate).
   */
  slotLocked?: (slot: number) => boolean;
  /**
   * Three Tricks: activate the special card at this hand index. When
   * provided, the detail sheet shows a Use button for unspent special
   * cards.
   */
  onUse?: (index: number) => void;
  /**
   * Live numbers behind a card's condition ("Suit perks spent so far:
   * 7") — rendered in the detail sheet under the description.
   */
  liveContext?: (card: BonusCard) => string[];
  /** Drop the "(each)" suffix from each chip's mult (end-game cells). */
  hideEach?: boolean;
  /** Streamlined docked strip (row layout): chips adopt the desk
   *  bonus-panel entry look. Ignored by the panel layout. */
  docked?: boolean;
}

/**
 * Held bonus cards as tappable chips; tapping opens the detail dialog
 * with the card's full description and category (or, during the Mixed
 * Bag slot choice, picks the slot).
 */
export function BonusCardStrip({
  cards,
  bonusDeckSize,
  values,
  title = 'Bonus cards',
  layout = 'panel',
  onSlotTap,
  slotLocked,
  onUse,
  liveContext,
  hideEach,
  docked,
}: BonusCardStripProps) {
  const [detail, setDetail] = useState<{ card: BonusCard; index: number } | null>(
    null
  );

  const tapChip = (card: BonusCard, index: number) => {
    // A used one-time slot is spent for the game, and a locked slot
    // (no-swap rules holding a live card) can't take a draw — during
    // the Mixed Bag slot pick both fall through to the detail sheet.
    if (onSlotTap && !isSpentSlot(card) && !slotLocked?.(index)) {
      onSlotTap(index);
    } else setDetail({ card, index });
  };

  const detailDialog = (
    <DetailSheet
      detail={detail}
      onClose={() => setDetail(null)}
      onUse={onUse}
      liveContext={liveContext}
    />
  );

  if (layout === 'row') {
    const emptySlots = Math.max(0, 3 - cards.length);
    return (
      <div
        className={`${styles.row} ${docked ? styles.rowDocked : ''}`}
        aria-label="Bonus cards"
      >
        {cards.map((card, i) => (
          <BonusChip
            key={`${card.id}-${i}`}
            card={card}
            value={values?.[i]}
            compact
            hideEach={hideEach}
            onClick={() => tapChip(card, i)}
          />
        ))}
        {Array.from({ length: emptySlots }, (_, i) => (
          <div key={`empty-${i}`} className={styles.emptySlot}>
            {cards.length === 0 && i === 0 ? '♣ draws fill these' : 'empty'}
          </div>
        ))}
        {bonusDeckSize !== undefined && (
          <span className={styles.deckHint}>♣{bonusDeckSize}</span>
        )}
        {detailDialog}
      </div>
    );
  }

  return (
    <section className={styles.strip} aria-label="Bonus cards">
      <div className={styles.heading}>
        <h2 className="text-section">{title}</h2>
        {bonusDeckSize !== undefined && (
          <span className={styles.deckCount}>{bonusDeckSize} in deck</span>
        )}
      </div>
      <div className={styles.chips}>
        {cards.length === 0 && (
          <span className={styles.emptyNote}>
            None held — a ♣ draw adds one.
          </span>
        )}
        {cards.map((card, i) => (
          <BonusChip
            key={`${card.id}-${i}`}
            card={card}
            value={values?.[i]}
            hideEach={hideEach}
            onClick={() => tapChip(card, i)}
          />
        ))}
      </div>
      {detailDialog}
    </section>
  );
}

// Exported for the ♣ draw's chip-ⓘ popup (BonusResolveDialog), so a
// card reads IDENTICALLY whether it's being offered or already held:
// name + mult in the title, category line, description.
export function DetailSheet({
  detail,
  onClose,
  onUse,
  liveContext,
}: {
  detail: { card: BonusCard; index: number } | null;
  onClose: () => void;
  onUse?: (index: number) => void;
  liveContext?: (card: BonusCard) => string[];
}) {
  const card = detail?.card ?? null;
  const detailStyle = card ? styleFor(card) : null;
  const assist = useSettingsStore(s => s.colorBlindAssist);
  const contextLines = card && liveContext ? liveContext(card) : [];
  const usable =
    card !== null &&
    onUse !== undefined &&
    isSpecialCard(card) &&
    !card.used &&
    !isPlaceholder(card);
  return (
    <Sheet open={detail !== null} onClose={onClose} title={card?.name ?? ''}>
      {card && detailStyle && (
        <div
          className={styles.detailBody}
          style={{ '--chip-tone': detailStyle.borderColor } as CSSProperties}
        >
          <span className={styles.detailCategory}>
            {/* Glyph gated on colorBlindAssist per the category-style
                contract — the text label always names the category. */}
            {assist && (
              <>
                <span style={categoryIconStyle(detailStyle)} aria-hidden="true">
                  {detailStyle.icon}
                </span>{' '}
              </>
            )}
            {detailStyle.label}
          </span>
          <p className="text-body">{card.description}</p>
          {contextLines.length > 0 && (
            <div className={styles.detailContext}>
              {contextLines.map(line => (
                <span key={line}>{line}</span>
              ))}
            </div>
          )}
          {card.used && (
            <p className="text-label">Already used this run.</p>
          )}
          {usable && detail && (
            <Button
              variant="primary"
              onClick={() => {
                onClose();
                onUse(detail.index);
              }}
            >
              Use card
            </Button>
          )}
        </div>
      )}
    </Sheet>
  );
}
