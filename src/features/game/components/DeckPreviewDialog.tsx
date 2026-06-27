import { CSSProperties, useMemo } from 'react';
import { RANKS, SUITS, Suit, Supercharge, isJoker } from '../../../game/cards';
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

  const { bySuit, charged, jokers } = useMemo(() => {
    const bySuit: Record<Suit, Set<string>> = { H: new Set(), S: new Set(), D: new Set(), C: new Set() };
    // Targets-Up upgrades (wild / double) carried into this deck — keyed
    // by `${suit}${rank}` so the peek can flag the exact upgraded card.
    const charged = new Map<string, Supercharge>();
    let jokers = 0;
    for (const c of state.deck) {
      if (isJoker(c)) jokers++;
      else {
        bySuit[c.suit].add(c.rank);
        if (c.supercharge) charged.set(`${c.suit}${c.rank}`, c.supercharge);
      }
    }
    return { bySuit, charged, jokers };
  }, [state.deck]);

  const hasCharged = charged.size > 0;

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
                const charge = present
                  ? charged.get(`${suit}${rank}`)
                  : undefined;
                const chargeTone =
                  charge === 'wild'
                    ? colors.joker
                    : charge === 'double'
                      ? colors.warn
                      : undefined;
                return (
                  <span
                    key={rank}
                    className={`${styles.rankCell} ${present ? styles.present : ''} ${charge ? styles.charged : ''}`}
                    style={
                      {
                        '--suit-tone': SUIT_TONE[suit],
                        ...(chargeTone ? { '--charge-tone': chargeTone } : {}),
                      } as CSSProperties
                    }
                    aria-label={`${rank} of ${SUIT_NAME[suit]} ${
                      present
                        ? charge
                          ? `in deck, upgraded ${charge}`
                          : 'in deck'
                        : 'gone'
                    }`}
                  >
                    {rank}
                    {charge && (
                      <sup className={styles.chargeMark}>
                        {charge === 'wild' ? 'W' : '2'}
                      </sup>
                    )}
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
        {hasCharged && (
          <p className={styles.legend}>
            Upgraded cards are ringed:{' '}
            <span style={{ color: colors.joker }}>
              <sup className={styles.chargeMark}>W</sup> wild
            </span>{' '}
            ·{' '}
            <span style={{ color: colors.warn }}>
              <sup className={styles.chargeMark}>2</sup> double
            </span>
          </p>
        )}
      </div>
    </Sheet>
  );
}
