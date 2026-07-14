import { CSSProperties, useState } from 'react';
import { SPOTLIGHT_ID } from '../../../game/bonusCards';
import {
  categoryIconStyle,
  styleFor,
  toneLabelFor,
} from '../../../lib/bonusCardCategory';
import { useSettingsStore } from '../../settings/settingsStore';
import { useGameSession } from '../GameSessionProvider';
import { BonusDialogUI } from '../usePhaseUI';
import styles from './BonusDrawModal.module.css';

/**
 * The desktop ♣ Bonus draw as the mockup's fixed-overlay modal
 * (design-refs/desktop/Play.dc.html lines 203–226). Same phase-UI
 * contract as the mobile in-dock BonusResolvePanel — pick / replace /
 * decline all dispatch the existing reducer actions; only the shell
 * differs. Desktop-only: mobile keeps BonusResolvePanel untouched.
 */
export function BonusDrawModal({ ui }: { ui: BonusDialogUI }) {
  // Colorblind assist (phase 4 port): glyph beside each option title,
  // same category-style contract as the phone surfaces.
  const assist = useSettingsStore(s => s.colorBlindAssist);
  const { state, dispatch } = useGameSession();
  // Board-peek dim arming: the overlay opens FULLY solid no matter
  // where the pointer sits, and only starts dimming after the pointer
  // has entered the dialog card once and then left. Resets on each
  // open (the modal unmounts between draws). Keyboard focus still
  // forces solid via the CSS :focus-within guard.
  const [hasHovered, setHasHovered] = useState(false);
  // Touch parity for that hover dim: coarse pointers can't hover, so a
  // TAP on the scrim (outside the card) fades the whole overlay down to
  // peek at the board behind, and any tap while peeking brings it back.
  // The scrim covers the screen, so both taps hit the scrim — never the
  // board / dock / nav behind it — matching "the restore tap triggers
  // nothing else." Resolved once at mount (stable).
  const [coarse] = useState(
    () =>
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(pointer: coarse)').matches
  );
  const [peek, setPeek] = useState(false);
  const onScrimClick = coarse
    ? (e: React.MouseEvent) => {
        // While peeking the card is pointer-events:none (see the module
        // CSS), so every tap lands here — restore, and only restore.
        if (peek) {
          setPeek(false);
          return;
        }
        // Not peeking: a tap directly on the scrim (outside the card) dims.
        if (e.target === e.currentTarget) setPeek(true);
      }
    : undefined;

  const pick = (idx: number) => {
    const card = ui.drawn[idx];
    if (ui.atCap && card.id !== SPOTLIGHT_ID) {
      dispatch({ type: 'BONUS_SELECT_NEW', idx });
    } else {
      dispatch({ type: 'BONUS_KEEP', idx });
    }
  };

  return (
    <div
      className={`${styles.scrim} ${hasHovered ? styles.scrimDimmable : ''} ${
        peek ? styles.scrimPeek : ''
      }`}
      onClick={onScrimClick}
    >
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label="Draw a bonus card"
        onMouseEnter={() => setHasHovered(true)}
      >
        <div className={styles.headRow}>
          <span className={styles.title}>Draw a bonus card</span>
          <span className={styles.spent}>♣ spent</span>
        </div>

        {ui.mode === 'resolving' ? (
          <>
            <p className={styles.sub}>Pick one to add to your hand.</p>
            <div className={styles.options}>
              {ui.drawn.map((card, i) => {
                const cat = styleFor(card);
                return (
                  <button
                    key={`${card.id}-${i}`}
                    type="button"
                    className={styles.option}
                    style={{ '--tone': cat.borderColor } as CSSProperties}
                    onClick={() => pick(i)}
                    aria-label={`Keep: ${card.title}`}
                  >
                    <span className={styles.optionCat}>
                      {toneLabelFor(card)}
                    </span>
                    <span className={styles.optionTitle}>
                      {assist && (
                        <>
                          <span
                            style={{
                              color: cat.iconColor,
                              ...categoryIconStyle(cat),
                            }}
                            aria-hidden="true"
                          >
                            {cat.icon}
                          </span>{' '}
                        </>
                      )}
                      {card.title}
                    </span>
                    <span className={styles.optionMult}>{card.mult}</span>
                    <span className={styles.optionDesc}>
                      {card.description}
                    </span>
                  </button>
                );
              })}
            </div>
            {ui.canDecline && (
              <div className={styles.declineRow}>
                <button
                  type="button"
                  className={styles.decline}
                  onClick={() => dispatch({ type: 'BONUS_DECLINE' })}
                >
                  Decline — discard the ♣{ui.atCap ? ' (hand full)' : ''}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className={styles.replaceHint}>
              Hand full — tap a card below to replace it:
            </p>
            <div className={styles.replaceRow}>
              {state.bonusCards.map((card, i) => {
                const cat = styleFor(card);
                return (
                  <button
                    key={`${card.id}-${i}`}
                    type="button"
                    className={styles.replaceChip}
                    style={{ '--tone': cat.borderColor } as CSSProperties}
                    onClick={() => dispatch({ type: 'BONUS_REPLACE', oldIdx: i })}
                    aria-label={`Swap out: ${card.title}`}
                  >
                    <span className={styles.replaceTitle}>
                      {assist && (
                        <>
                          <span
                            style={{
                              color: cat.iconColor,
                              ...categoryIconStyle(cat),
                            }}
                            aria-hidden="true"
                          >
                            {cat.icon}
                          </span>{' '}
                        </>
                      )}
                      {card.title}
                    </span>
                    <span className={styles.replaceMult}>{card.mult}</span>
                  </button>
                );
              })}
            </div>
            {ui.canGoBack && (
              <div className={styles.declineRow}>
                <button
                  type="button"
                  className={styles.decline}
                  onClick={() => dispatch({ type: 'BONUS_BACK' })}
                >
                  ← Back to card select
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
