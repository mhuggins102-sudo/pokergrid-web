import { CSSProperties } from 'react';
import { Link } from 'react-router';
import {
  BONUS_DECK_POOL,
  BonusCard,
  SPECIAL_DECK_POOL,
} from '../../game/bonusCards';
import {
  BonusCategory,
  CATEGORY_LABEL,
  categoryOf,
  styleFor,
} from '../../lib/bonusCardCategory';
import styles from './BonusCardReferencePage.module.css';

const GROUP_ORDER: BonusCategory[] = [
  'hand',
  'line',
  'suit',
  'conditional',
  'grid',
  'deck-management',
  'special',
];

const GROUP_BLURB: Record<BonusCategory, string> = {
  hand: 'Gold — multiply every line that scores the named hand, as the run unfolds.',
  line: 'Gold — multiply one specific row, column, or location on the board.',
  suit: 'Gold — multiply a line per matching suit card in it.',
  conditional:
    'Gold — multiply lines that meet a condition (totals, aces, suits…).',
  grid: 'Purple — judged once at game end, against the whole final board.',
  'deck-management':
    'Purple — judged at game end, against how the run was played (perks spent, deck left…).',
  special:
    'Green — one-time actions from the Three Tricks and Mixed Bag twists. No scoring effect; tap the held card and press Use to fire it. Consumed on use.',
};

function CardEntry({ card }: { card: BonusCard }) {
  const tone = styleFor(card);
  return (
    <article
      className={styles.card}
      style={{ '--card-tone': tone.borderColor } as CSSProperties}
    >
      <div className={styles.cardTop}>
        <span className={styles.cardTitle}>
          {tone.icon} {card.title}
        </span>
        {card.mult && <span className={styles.cardMult}>{card.mult}</span>}
      </div>
      <p className={styles.cardDesc}>{card.description}</p>
    </article>
  );
}

/**
 * /rules/cards — the complete bonus-card catalog, grouped by category
 * in the same tones the in-game chips use.
 */
export function BonusCardReferencePage() {
  const groups = new Map<BonusCategory, BonusCard[]>();
  for (const card of [...BONUS_DECK_POOL, ...SPECIAL_DECK_POOL]) {
    const cat = categoryOf(card);
    groups.set(cat, [...(groups.get(cat) ?? []), card]);
  }

  return (
    <section className={styles.wrap}>
      <header>
        <Link to="/rules" className={styles.back}>
          ← How to Play
        </Link>
        <h1 className="text-title">Bonus card reference</h1>
        <p className="text-body" style={{ color: 'var(--ink-2)' }}>
          Every card that can turn up in a ♣ Bonus draw, plus the one-time
          action cards from the twisted modes. Chip color tells you when a
          card pays: gold during the run, purple at game end, green on use.
        </p>
      </header>

      {GROUP_ORDER.map(cat => {
        const cards = groups.get(cat);
        if (!cards || cards.length === 0) return null;
        const tone = styleFor(cards[0]);
        return (
          <div key={cat} className={styles.group}>
            <div
              className={styles.groupHeader}
              style={{ '--group-tone': tone.borderColor } as CSSProperties}
            >
              <span className={styles.groupIcon} aria-hidden="true">
                {tone.icon}
              </span>
              <h2 className="text-section">
                {CATEGORY_LABEL[cat]} · {cards.length}
              </h2>
            </div>
            <p className={styles.groupBlurb}>{GROUP_BLURB[cat]}</p>
            <div className={styles.cards}>
              {cards.map(card => (
                <CardEntry key={card.id} card={card} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
