import { CSSProperties, useState } from 'react';
import { Link } from 'react-router';
import {
  BONUS_DECK_POOL,
  BonusCard,
  SPECIAL_DECK_POOL,
} from '../../game/bonusCards';
import { HandRank } from '../../game/hands';
import { HAND_BASE_VALUE, INCOMPLETE_LINE_PENALTY } from '../../game/scoring';
import { HAND_LABEL } from '../game/handLabels';
import { BonusCategory, categoryOf } from '../../lib/bonusCardCategory';
import { useTier } from '../../app/useTier';
import styles from './RulesPage.module.css';

/*
 * The rules page at every tier (phase 3 convergence), per
 * design-refs/desktop/Rules.dc.html: numbered how-to-play steps + the
 * −25 / 10-lines fact cards beside the hand-values table, then the
 * full bonus-card reference inline — filterable by the three payout
 * tones (in-game gold, end-game purple, one-time green). Hand values
 * and cards bind to the real scoring tables / bonus pools. The
 * standalone /rules/cards reference stays for deep links.
 */

// Ascending, matching the mockup's low → high ordering.
const HAND_ORDER: HandRank[] = [
  'HIGH_CARD',
  'PAIR',
  'TWO_PAIR',
  'THREE_OF_A_KIND',
  'STRAIGHT',
  'FLUSH',
  'FULL_HOUSE',
  'FOUR_OF_A_KIND',
  'STRAIGHT_FLUSH',
  'ROYAL_FLUSH',
  'FIVE_OF_A_KIND',
];

const STEPS = [
  {
    n: '1',
    title: 'Place 25 cards',
    body: 'Draw a card from the deck and drop it onto the 5×5 grid — normally along a spiral. Fill every cell.',
  },
  {
    n: '2',
    title: 'Build 10 poker hands',
    body: 'Each of the 5 rows and 5 columns scores as its own 5-card poker hand. Ten lines, ten scores.',
  },
  {
    n: '3',
    title: 'Spend suit perks',
    body: 'Instead of placing, spend the drawn card on its suit: ♥ swap, ♠ slide, ♦ destroy, ♣ draw a bonus card.',
  },
  {
    n: '4',
    title: 'Beat the target',
    body: 'Bonus cards multiply lines and the whole grid. Clear the difficulty target — mind the −25 per unfinished line.',
  },
];

// The mockup's three payout groups. Every card in the real pools maps
// onto one via its category tone (gold / purple / green).
type ToneGroup = 'in-game' | 'end-game' | 'special';

const TONE_GROUP_OF: Record<BonusCategory, ToneGroup> = {
  hand: 'in-game',
  line: 'in-game',
  suit: 'in-game',
  conditional: 'in-game',
  grid: 'end-game',
  'deck-management': 'end-game',
  special: 'special',
};

const GROUP_META: Record<
  ToneGroup,
  { label: string; note: string; tone: string }
> = {
  'in-game': {
    label: 'In-game multiplier',
    tone: 'var(--warn)',
    note: 'Yellow · boosts a line while you play',
  },
  'end-game': {
    label: 'End-game multiplier',
    tone: 'var(--joker)',
    note: 'Purple · scores the whole grid at the finish',
  },
  special: {
    label: 'One-time action',
    tone: 'var(--accent)',
    note: 'Green · a single-use move, then spent',
  },
};

const GROUP_ORDER: ToneGroup[] = ['in-game', 'end-game', 'special'];

const TABS: Array<{ key: 'all' | ToneGroup; label: string }> = [
  { key: 'all', label: 'All cards' },
  { key: 'in-game', label: 'In-game' },
  { key: 'end-game', label: 'End-game' },
  { key: 'special', label: 'One-time' },
];

export function RulesPage() {
  const [filter, setFilter] = useState<'all' | ToneGroup>('all');
  const isPhone = useTier() === 'phone';
  // Phone drops the "All cards" tab; the three remaining tabs are
  // toggles (clicking the active one clears it back to 'all' = show
  // all). ≥768 keeps the four-tab set with plain selection.
  const tabs = isPhone ? TABS.filter(t => t.key !== 'all') : TABS;

  const maxBase = Math.max(...HAND_ORDER.map(h => HAND_BASE_VALUE[h]), 1);

  const grouped = new Map<ToneGroup, BonusCard[]>();
  for (const card of [...BONUS_DECK_POOL, ...SPECIAL_DECK_POOL]) {
    const g = TONE_GROUP_OF[categoryOf(card)];
    grouped.set(g, [...(grouped.get(g) ?? []), card]);
  }

  return (
    <div className={styles.wrap}>
      <section className={styles.topGrid}>
        <div>
          {/* Phone: a section heading in the Bonus-card-reference style
              leads the steps (the eyebrow + big page title are CSS-hidden
              here). ≥768 keeps the eyebrow + Fraunces title untouched. */}
          {isPhone && <h2 className={styles.refTitle}>How to play</h2>}
          <div className={styles.eyebrow}>Rules</div>
          <h1 className={styles.title}>How PokerGrid works</h1>
          <div className={styles.steps}>
            {STEPS.map(s => (
              <div key={s.n} className={styles.step}>
                <span className={styles.stepNum} aria-hidden="true">
                  {s.n}
                </span>
                <div>
                  <div className={styles.stepTitle}>{s.title}</div>
                  <div className={styles.stepBody}>{s.body}</div>
                </div>
              </div>
            ))}
          </div>
          {/* Not in the mockup — keeps the guided tutorial reachable on
              desktop (feature-reachability convention). */}
          <p className={styles.tutorialLink}>
            Prefer to learn by playing?{' '}
            <Link to="/tutorial">Take the interactive tutorial</Link>
          </p>
          <div className={styles.facts}>
            <div className={styles.fact}>
              <div className={`${styles.factNum} ${styles.factDanger}`}>
                {INCOMPLETE_LINE_PENALTY}
              </div>
              <div className={styles.factBody}>
                per incomplete row or column at game end
              </div>
            </div>
            <div className={styles.fact}>
              <div className={`${styles.factNum} ${styles.factAccent}`}>10</div>
              <div className={styles.factBody}>
                scoring lines — 5 rows + 5 columns
              </div>
            </div>
          </div>
        </div>

        {/* Phone: matching section heading above the table (the in-panel
            title below is dropped so it isn't shown twice). ≥768 keeps the
            in-panel handTitle and no outer heading. */}
        {isPhone && <h2 className={styles.refTitle}>Hand values</h2>}
        <div className={styles.handPanel}>
          {!isPhone && <h2 className={styles.handTitle}>Hand values</h2>}
          <div className={styles.handList}>
            {HAND_ORDER.map(h => {
              const base = HAND_BASE_VALUE[h];
              const zero = base === 0;
              return (
                <div key={h} className={styles.handRow}>
                  <span
                    className={`${styles.handName} ${zero ? styles.handNameZero : ''}`}
                  >
                    {HAND_LABEL[h]}
                  </span>
                  <span
                    className={styles.handPts}
                    style={{
                      color: zero
                        ? 'var(--ink-3)'
                        : `color-mix(in srgb, var(--accent) ${Math.round(
                            40 + (base / maxBase) * 60
                          )}%, var(--ink))`,
                    }}
                  >
                    {base}
                  </span>
                </div>
              );
            })}
          </div>
          <p className={styles.handFoot}>
            Base points per line, before any bonus-card multipliers. A
            line&apos;s multipliers compose, then round up; grid-wide bonuses
            multiply the final total.
          </p>
        </div>
      </section>

      <section className={styles.refSection}>
        <div className={styles.refHead}>
          <h2 className={styles.refTitle}>Bonus card reference</h2>
        </div>
        <div className={styles.tabs}>
          {tabs.map(t => (
            <button
              key={t.key}
              type="button"
              className={`${styles.tab} ${filter === t.key ? styles.tabOn : ''}`}
              aria-pressed={filter === t.key}
              onClick={() =>
                setFilter(cur =>
                  isPhone && cur === t.key ? 'all' : t.key
                )
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className={styles.groups}>
          {GROUP_ORDER.filter(g => filter === 'all' || filter === g).map(g => {
            const meta = GROUP_META[g];
            const cards = grouped.get(g) ?? [];
            return (
              <div key={g}>
                <div className={styles.groupHead}>
                  <span
                    className={styles.groupSwatch}
                    style={{ background: meta.tone }}
                    aria-hidden="true"
                  />
                  <h3 className={styles.groupTitle}>{meta.label}</h3>
                  <span className={styles.groupNote}>{meta.note}</span>
                </div>
                <div className={styles.cardGrid}>
                  {cards.map(c => (
                    <div
                      key={c.id}
                      className={styles.card}
                      style={{ '--group-tone': meta.tone } as CSSProperties}
                    >
                      <div className={styles.cardTop}>
                        <span className={styles.cardTitle}>{c.title}</span>
                        <span className={styles.cardMult}>{c.mult}</span>
                      </div>
                      <div className={styles.cardDesc}>{c.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
