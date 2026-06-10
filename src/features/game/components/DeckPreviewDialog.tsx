import { CSSProperties, useMemo } from 'react';
import { RANKS, SUITS, Suit, isJoker } from '../../../game/cards';
import { colors } from '../../../design/tokens';
import { Sheet } from '../../../design/primitives';
import { useGameSession } from '../GameSessionProvider';
import styles from './DeckPreviewDialog.module.css';

const SUIT_GLYPH: Record<Suit, string> = { H: '♥', S: '♠', D: '♦', C: '♣' };
const SUIT_NAME: Record<Suit, string> = {
  H: 'Hearts',
  S: 'Spades',
  D: 'Diamonds',
  C: 'Clubs',
};
const SUIT_TONE: Record<Suit, string> = {
  H: colors.suitH,
  S: colors.suitS,
  D: colors.suitD,
  C: colors.suitC,
};

/**
 * "Peek deck" (Easy / Medium only): which cards are still waiting in the
 * playing deck, as a 13-rank strip per suit plus a joker count.
 */
export function DeckPreviewDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { state } = useGameSession();

  const { bySuit, jokers } = useMemo(() => {
    const bySuit: Record<Suit, Set<string>> = { H: new Set(), S: new Set(), D: new Set(), C: new Set() };
    let jokers = 0;
    for (const c of state.deck) {
      if (isJoker(c)) jokers++;
      else bySuit[c.suit].add(c.rank);
    }
    return { bySuit, jokers };
  }, [state.deck]);

  return (
    <Sheet open={open} onClose={onClose} title="Remaining deck">
      <div className={styles.body}>
        {SUITS.map(suit => (
          <div key={suit} className={styles.suitRow}>
            <div
              className={styles.suitHeader}
              style={{ color: SUIT_TONE[suit] }}
            >
              <span>
                {SUIT_GLYPH[suit]} {SUIT_NAME[suit]}
              </span>
              <span className={styles.suitCount}>
                {bySuit[suit].size} / 13
              </span>
            </div>
            <div className={styles.ranks}>
              {RANKS.map(rank => {
                const present = bySuit[suit].has(rank);
                return (
                  <span
                    key={rank}
                    className={`${styles.rankCell} ${present ? styles.present : ''}`}
                    style={{ '--suit-tone': SUIT_TONE[suit] } as CSSProperties}
                    aria-label={`${rank} of ${SUIT_NAME[suit]} ${present ? 'in deck' : 'gone'}`}
                  >
                    {rank}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
        {jokers > 0 && (
          <div className={styles.suitHeader} style={{ color: colors.joker }}>
            <span>★ Jokers</span>
            <span className={styles.suitCount}>{jokers} remaining</span>
          </div>
        )}
      </div>
    </Sheet>
  );
}
