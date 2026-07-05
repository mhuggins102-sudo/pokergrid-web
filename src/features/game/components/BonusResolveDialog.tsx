import { CSSProperties, useState } from 'react';
import { BonusCard, SPOTLIGHT_ID } from '../../../game/bonusCards';
import { categoryIconStyle, styleFor } from '../../../lib/bonusCardCategory';
import { Sheet } from '../../../design/primitives';
import { useSettingsStore } from '../../settings/settingsStore';
import { useGameSession } from '../GameSessionProvider';
import { BonusDialogUI } from '../usePhaseUI';
import styles from './BonusResolveDialog.module.css';

function CardChip({
  card,
  ariaPrefix,
  onPick,
  onInfo,
}: {
  card: BonusCard;
  ariaPrefix: string;
  onPick: () => void;
  /** Omitted on the swap-out chips — held cards' details already live
   *  in the bonus row. */
  onInfo?: () => void;
}) {
  const cat = styleFor(card);
  // Glyph gated on colorBlindAssist per the category-style contract.
  const assist = useSettingsStore(s => s.colorBlindAssist);
  return (
    <div
      className={styles.chipWrap}
      style={{ '--chip-tone': cat.borderColor } as CSSProperties}
    >
      <button
        type="button"
        className={styles.chip}
        onClick={onPick}
        aria-label={`${ariaPrefix}: ${card.title}`}
      >
        <span className={styles.chipTitle}>
          {assist && (
            <>
              <span style={categoryIconStyle(cat)} aria-hidden="true">
                {cat.icon}
              </span>{' '}
            </>
          )}
          {card.title}
        </span>
        <span className={styles.chipMult}>{card.mult}</span>
      </button>
      {onInfo && (
        <button
          type="button"
          className={styles.chipInfo}
          onClick={onInfo}
          aria-label={`About ${card.title}`}
        >
          ⓘ
        </button>
      )}
    </div>
  );
}

/**
 * The ♣ Bonus draw flow, rendered IN the dock — not a modal — so the
 * board stays fully visible while choosing. The options are compact
 * chips (title + mult) sized to fit inside the dock's pinned height,
 * so the board and dock never move during any ♣ step; each chip's ⓘ
 * opens the full description in a sheet for anyone who wants it. At
 * the cap, picking a non-Spotlight card moves to the replace step;
 * Spotlight skips it (it evicts the hand by rule).
 */
export function BonusResolvePanel({ ui }: { ui: BonusDialogUI }) {
  const { state, dispatch } = useGameSession();
  const [info, setInfo] = useState<BonusCard | null>(null);

  // Mirrors the held-card details sheet: category line in the card's
  // tone (with the colorblind-assist glyph), then the full description.
  const infoStyle = info ? styleFor(info) : null;
  const assist = useSettingsStore(s => s.colorBlindAssist);
  const infoSheet = (
    <Sheet
      open={info !== null}
      onClose={() => setInfo(null)}
      title={info?.title}
    >
      {info && infoStyle && (
        <div
          className={styles.infoBody}
          style={{ '--chip-tone': infoStyle.borderColor } as CSSProperties}
        >
          <span className={styles.infoCategory}>
            {assist && (
              <>
                <span style={categoryIconStyle(infoStyle)} aria-hidden="true">
                  {infoStyle.icon}
                </span>{' '}
              </>
            )}
            {infoStyle.label}
          </span>
          <p className={styles.infoDesc}>{info.description}</p>
          <p className={styles.infoMult}>{info.mult}</p>
        </div>
      )}
    </Sheet>
  );

  if (ui.mode === 'replacing') {
    const incoming = ui.drawn[ui.pickedNew ?? 0];
    return (
      <div className={styles.panel}>
        <button
          type="button"
          className={styles.close}
          aria-label="Back"
          onClick={() => dispatch({ type: 'CANCEL_ACTION' })}
        >
          ✕
        </button>
        <p className={styles.hint}>
          Keeping “{incoming?.title}” — swap out which card?
        </p>
        <div className={styles.choices}>
          {state.bonusCards.map((card, i) => (
            <CardChip
              key={`${card.id}-${i}`}
              card={card}
              ariaPrefix="Swap out"
              onPick={() => dispatch({ type: 'BONUS_REPLACE', oldIdx: i })}
            />
          ))}
        </div>
        {infoSheet}
      </div>
    );
  }

  const pick = (idx: number) => {
    const card = ui.drawn[idx];
    if (ui.atCap && card.id !== SPOTLIGHT_ID) {
      dispatch({ type: 'BONUS_SELECT_NEW', idx });
    } else {
      dispatch({ type: 'BONUS_KEEP', idx });
    }
  };

  return (
    <div className={styles.panel}>
      {ui.canDecline && (
        <button
          type="button"
          className={styles.close}
          aria-label="Decline both"
          onClick={() => dispatch({ type: 'BONUS_DECLINE' })}
        >
          ✕
        </button>
      )}
      <p className={styles.hint}>
        ♣ Bonus draw —{' '}
        {ui.atCap
          ? 'hand full'
          : ui.drawn.length > 1
            ? 'keep one of the two'
            : 'keep this card?'}
      </p>
      {ui.atCap && (
        <p className={styles.hintSub}>
          {ui.canDecline
            ? 'Keep one, or tap ✕ to decline'
            : 'Keep one, then swap out a held card'}
        </p>
      )}
      <div className={styles.choices}>
        {ui.drawn.map((card, i) => (
          <CardChip
            key={`${card.id}-${i}`}
            card={card}
            ariaPrefix="Keep"
            onPick={() => pick(i)}
            onInfo={() => setInfo(card)}
          />
        ))}
      </div>
      {infoSheet}
    </div>
  );
}
