import { CSSProperties, useMemo } from 'react';
import { RANKS, SUITS, Suit, Supercharge, isJoker } from '../../../game/cards';
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
  H: 'var(--suit-h)',
  S: 'var(--suit-s)',
  D: 'var(--suit-d)',
  C: 'var(--suit-c)',
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

  const dualDeck = state.doubleDuty;

  const { counts, charged, jokers } = useMemo(() => {
    // How many copies of each identity remain: 0/1 normally; in Double
    // Duty both halves of every remaining card count, so 0/1/2.
    const counts: Record<Suit, Map<string, number>> = {
      H: new Map(),
      S: new Map(),
      D: new Map(),
      C: new Map(),
    };
    const bump = (suit: Suit, rank: string) =>
      counts[suit].set(rank, (counts[suit].get(rank) ?? 0) + 1);
    // Targets-Up upgrades (wild / double) carried into this deck — keyed
    // by `${suit}${rank}` so the peek can flag the exact upgraded card.
    // Never co-occurs with Double Duty duals (Targets-Up only).
    const charged = new Map<string, Supercharge>();
    let jokers = 0;
    for (const c of state.deck) {
      if (isJoker(c)) jokers++;
      else {
        bump(c.suit, c.rank);
        if (c.dual) bump(c.dual.suit, c.dual.rank);
        if (c.supercharge) charged.set(`${c.suit}${c.rank}`, c.supercharge);
      }
    }
    return { counts, charged, jokers };
  }, [state.deck]);

  const hasCharged = charged.size > 0;
  const suitTotal = (suit: Suit): number => {
    let n = 0;
    for (const v of counts[suit].values()) n += v;
    return n;
  };

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
                {dualDeck
                  ? `${suitTotal(suit)} / 26`
                  : `${counts[suit].size} / 13`}
              </span>
            </div>
            <div className={styles.ranks}>
              {RANKS.map(rank => {
                const copies = counts[suit].get(rank) ?? 0;
                const present = copies > 0;
                const charge = present
                  ? charged.get(`${suit}${rank}`)
                  : undefined;
                const chargeTone =
                  charge === 'wild'
                    ? 'var(--joker)'
                    : charge === 'double'
                      ? 'var(--warn)'
                      : undefined;
                // Double Duty: full brightness only while BOTH halves of
                // an identity remain; one copy left renders half-dimmed.
                const faded = dualDeck && copies === 1;
                return (
                  <span
                    key={rank}
                    className={`${styles.rankCell} ${present ? styles.present : ''} ${faded ? styles.presentFaded : ''} ${charge ? styles.charged : ''}`}
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
                          : dualDeck
                            ? `in deck, ${copies === 2 ? '2 copies' : '1 copy'}`
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
          <div className={styles.suitHeader} style={{ color: 'var(--joker)' }}>
            <span>★ Jokers</span>
            <span className={styles.suitCount}>{jokers} remaining</span>
          </div>
        )}
        {dualDeck && (
          <p className={styles.legend}>
            Counts include both halves of every two-way card — bright ranks
            have both copies still in the deck, dimmed ranks have one left.
          </p>
        )}
        {hasCharged && (
          <p className={styles.legend}>
            Upgraded cards are ringed:{' '}
            <span style={{ color: 'var(--joker)' }}>
              <sup className={styles.chargeMark}>W</sup> wild
            </span>{' '}
            ·{' '}
            <span style={{ color: 'var(--warn)' }}>
              <sup className={styles.chargeMark}>2</sup> double
            </span>
          </p>
        )}
      </div>
    </Sheet>
  );
}
