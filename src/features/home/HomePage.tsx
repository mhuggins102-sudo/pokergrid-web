import { CSSProperties, useState } from 'react';
import { Link } from 'react-router';
import { markTutorialSeen, tutorialSeen } from '../tutorial/tutorialSeen';
import { CHALLENGES, findChallenge } from '../../game/challenges';
import { dailyTargetFor, recipeFor } from '../../game/daily/recipe';
import { currentDateISO } from '../../game/daily/seed';
import { difficultyColors } from '../../design/tokens';
import { useTier } from '../../app/useTier';
import {
  bestDailyStreak,
  dailyStreak,
  readPlayedDatesLite,
} from '../daily/streak';
import styles from './HomePage.module.css';

/*
 * The landing page at every tier (phase 4 convergence), per
 * design-refs/desktop/Home.dc.html: a hero CTA for today's daily
 * (recipe chips + streak), the three-mode card row, and the newcomer
 * footer strip — which, on a first visit, upgrades to the tutorial
 * callout (prominent CTA + dismiss; the ported phone behavior). Every
 * number binds to the real recipe / challenge catalog / streak helper.
 */

// The mockup's decorative 3×3 of card faces on the hero's right panel.
const HERO_CARDS: { rank: string; suit: 'h' | 'd' | 'c' | 's' }[] = [
  { rank: 'A', suit: 's' },
  { rank: 'K', suit: 'h' },
  { rank: 'Q', suit: 'd' },
  { rank: 'J', suit: 'c' },
  { rank: '10', suit: 's' },
  { rank: '9', suit: 'h' },
  { rank: '8', suit: 'd' },
  { rank: '7', suit: 'c' },
  { rank: '6', suit: 's' },
];

const SUIT_GLYPH = { h: '♥', d: '♦', c: '♣', s: '♠' } as const;
const SUIT_TONE = {
  h: 'var(--face-suit-h)',
  d: 'var(--face-suit-d)',
  c: 'var(--face-suit-c)',
  s: 'var(--face-suit-s)',
} as const;

// "Friday, July 10" — built from the daily's ISO parts (never
// `new Date('YYYY-MM-DD')`, which parses as UTC and can shift a day).
const heroDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
};

export function HomePage() {
  // First-visit tutorial callout in the footer strip; "No thanks"
  // suppresses it for good (the tutorial stays reachable from Rules
  // and Settings).
  const [showIntro, setShowIntro] = useState(() => !tutorialSeen());
  const today = currentDateISO();
  const recipe = recipeFor(today);
  const twist = recipe.twist ? findChallenge(recipe.twist) : null;
  const target = dailyTargetFor(recipe.difficulty, recipe.twist);
  // Engine-free snapshot (the dailyWinsLite pattern): Home stays out
  // of the engine chunk, and remounts on navigation keep it fresh.
  const [streak] = useState(() => {
    const s = dailyStreak(readPlayedDatesLite(), today);
    return { ...s, best: bestDailyStreak(s.best) };
  });
  const diffTone = difficultyColors[recipe.difficulty];
  const isPhone = useTier() === 'phone';

  // The three mode cards — identical at every tier; only their
  // container (the desk mode row vs the phone 2×2 grid) differs.
  const modeCards = (
    <>
      <Link to="/play" className={styles.modeCard}>
        <span className={styles.modeTitle}>Free Play</span>
        <span className={styles.modeBlurb}>
          Pick any difficulty and play as many boards as you like.
          Doesn&apos;t touch the daily leaderboard.
        </span>
        <span className={styles.modeLink}>Choose a difficulty →</span>
      </Link>
      <Link to="/challenges" className={styles.modeCard}>
        <span className={styles.modeTitle}>Challenges</span>
        <span className={styles.modeBlurb}>
          Ten twisted rule sets — No Discards, Short Deck, Poker Purist and
          more. Beat them all for the sweep.
        </span>
        <span className={styles.modeLink}>{CHALLENGES.length} modes to beat →</span>
      </Link>
      <Link to="/stats" className={styles.modeCard}>
        <span className={styles.modeTitle}>Stats</span>
        <span className={styles.modeBlurb}>
          Best scores, win rate, and tier ratings by difficulty, filtered by
          mode and level.
        </span>
        <span className={styles.modeLink}>See your stats →</span>
      </Link>
    </>
  );

  return (
    <div className={styles.wrap}>
      {/* HERO — today's daily. A <div> with a stretched primary link
          (the CTA's ::after covers the card) instead of one big <a>,
          so the quiet archive link can sit beside the CTA without
          nesting anchors. */}
      <div className={styles.hero}>
        <div className={styles.heroBody}>
          <div className={styles.heroEyebrow}>
            <span className={styles.heroKicker}>Today&apos;s Daily</span>
            <span className={styles.heroDot} aria-hidden="true" />
            <span className={styles.heroDate}>{heroDate(today)}</span>
          </div>
          <h1 className={styles.heroTitle}>
            One grid.
            <br />
            Everyone plays the same deal.
          </h1>
          <div className={styles.heroChips}>
            <span
              className={styles.diffChip}
              style={{ '--tone': diffTone } as CSSProperties}
            >
              <span className={styles.diffDot} aria-hidden="true" />
              {recipe.difficulty} · {target}
            </span>
            {twist && (
              <span className={styles.twistChip}>✦ {twist.name}</span>
            )}
            {streak.current > 0 && (
              <span className={styles.streakChip}>
                🔥 {streak.current}-day streak
              </span>
            )}
          </div>
          <div className={styles.heroCtaRow}>
            <Link to="/daily" className={styles.heroCta}>
              Play today&apos;s puzzle <span aria-hidden="true">→</span>
            </Link>
            <Link to="/daily/archive" className={styles.heroArchive}>
              Browse the archive <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        <div className={styles.heroArt} aria-hidden="true">
          <div className={styles.heroGrid}>
            {HERO_CARDS.map((c, i) => (
              <div
                key={i}
                className={styles.heroCard}
                style={{ color: SUIT_TONE[c.suit] }}
              >
                <span className={styles.heroCardWm}>{SUIT_GLYPH[c.suit]}</span>
                <span className={styles.heroCardRank}>{c.rank}</span>
                <span className={styles.heroCardPip}>{SUIT_GLYPH[c.suit]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isPhone ? (
        /* Phone: the three mode cards + the newcomer strip become a
           2×2 grid of half-width cards — the strip's content rides as
           the fourth card (both its first-visit and quiet variants). */
        <div className={styles.phoneGrid}>
          {modeCards}
          {showIntro ? (
            <div className={styles.footerCard}>
              <span className={styles.modeTitle}>First time here?</span>
              <span className={styles.modeBlurb}>
                Learn by playing — a guided practice deal walks you through
                every move in about three minutes.
              </span>
              <span className={styles.footerCardActions}>
                <Link to="/tutorial" className={styles.footerCta}>
                  Start the tutorial
                </Link>
                <button
                  type="button"
                  className={styles.footerDismiss}
                  onClick={() => {
                    markTutorialSeen();
                    setShowIntro(false);
                  }}
                >
                  No thanks
                </button>
              </span>
            </div>
          ) : (
            <div className={styles.footerCard}>
              <span className={styles.modeTitle}>New here?</span>
              <span className={styles.modeBlurb}>
                The whole game is 25 cards, 10 poker hands, one target.
              </span>
              <Link to="/rules" className={styles.modeLink}>
                Read the rules →
              </Link>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* MODE ROW */}
          <div className={styles.modeRow}>{modeCards}</div>

          {/* FOOTER STRIP — the tutorial callout on a first visit, the
              quiet rules pointer ever after. */}
          {showIntro ? (
            <div className={styles.footerStrip}>
              <span className={styles.footerText}>
                <span className={styles.footerLead}>First time here?</span> Learn
                by playing — a guided practice deal walks you through every move
                in about three minutes.
              </span>
              <span className={styles.footerActions}>
                <Link to="/tutorial" className={styles.footerCta}>
                  Start the tutorial
                </Link>
                <button
                  type="button"
                  className={styles.footerDismiss}
                  onClick={() => {
                    markTutorialSeen();
                    setShowIntro(false);
                  }}
                >
                  No thanks
                </button>
              </span>
            </div>
          ) : (
            <div className={styles.footerStrip}>
              <span className={styles.footerText}>
                <span className={styles.footerLead}>New here?</span> The whole
                game is 25 cards, 10 poker hands, one target.
              </span>
              <Link to="/rules" className={styles.footerLink}>
                Read the rules →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
