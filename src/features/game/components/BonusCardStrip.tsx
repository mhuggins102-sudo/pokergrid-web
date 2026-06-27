import { CSSProperties, useState } from 'react';
import { BonusCard, isPlaceholder, isSpecialCard } from '../../../game/bonusCards';
import { styleFor } from '../../../lib/bonusCardCategory';
import { Button, Sheet } from '../../../design/primitives';
import styles from './BonusCardStrip.module.css';

export function BonusChip({
  card,
  onClick,
  value,
  compact,
}: {
  card: BonusCard;
  onClick?: () => void;
  /** Optional resolved contribution (Shapley points). */
  value?: number;
  /** Slim corner badge (no " pts" suffix) for the in-game row strip. */
  compact?: boolean;
}) {
  const cat = styleFor(card);
  const dimmed = card.used || isPlaceholder(card);
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
        {card.title}
        {card.used ? ' ✓' : ''}
      </span>
      <span className={styles.chipMult}>{card.mult}</span>
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
  onUse,
  liveContext,
}: BonusCardStripProps) {
  const [detail, setDetail] = useState<{ card: BonusCard; index: number } | null>(
    null
  );

  const tapChip = (card: BonusCard, index: number) => {
    if (onSlotTap) onSlotTap(index);
    else setDetail({ card, index });
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
      <div className={styles.row} aria-label="Bonus cards">
        {cards.map((card, i) => (
          <BonusChip
            key={`${card.id}-${i}`}
            card={card}
            value={values?.[i]}
            compact
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
            onClick={() => tapChip(card, i)}
          />
        ))}
      </div>
      {detailDialog}
    </section>
  );
}

function DetailSheet({
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
            {detailStyle.icon} {detailStyle.label}
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
