import { CSSProperties, useState } from 'react';
import { Link } from 'react-router';
import { tutorialSeen } from '../tutorial/tutorialSeen';
import { CHALLENGES, findChallenge } from '../../game/challenges';
import { dailyTargetFor, recipeFor } from '../../game/daily/recipe';
import { currentDateISO } from '../../game/daily/seed';
import { Difficulty, difficultyColors } from '../../design/tokens';
import { useTier } from '../../app/useTier';
import { Tier, tierForRun } from '../../lib/stats';
import { useStatsStore } from '../progress/statsStore';
import {
  bestDailyStreak,
  dailyStreak,
  readPlayedDatesLite,
} from '../daily/streak';
import styles from './HomePage.module.css';

// Quick Start row — one-tap Free Play at each difficulty (every tier).
// Full names (not initials) so Easy/Extreme never collide; color coding
// mirrors the difficulty tokens used everywhere else.
const QUICK_DIFFS: Difficulty[] = ['easy', 'medium', 'hard', 'extreme'];
const DIFF_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  extreme: 'Extreme',
};

// Tier badge tones — mirrors the daily archive's result row so a played
// day reads identically on the Home hero and in the archive.
const TIER_TONE: Record<Tier, string> = {
  SS: 'var(--success)',
  S: 'var(--success)',
  A: 'var(--warn)',
  B: 'var(--ink-2)',
  C: 'var(--ink-3)',
  D: 'var(--danger)',
};

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
  // Today's completed run, if any — the raw play carries score + won (just
  // not the rehydrated bonus-card fns), so the hero can show the result
  // without pulling the engine chunk in via playsStore.
  const [todayResult] = useState(() => {
    const raw = readPlayedDatesLite()[today] as
      | { score: number; won: boolean }
      | undefined;
    return raw ? { score: raw.score, won: raw.won } : null;
  });
  const todayTier = todayResult
    ? tierForRun({ score: todayResult.score, target, won: todayResult.won })
    : null;
  const diffTone = difficultyColors[recipe.difficulty];
  const isPhone = useTier() === 'phone';
  // Newcomer card (every tier): the tutorial callout gives way to the
  // quiet "Rules" pointer once the player has either taken the tutorial
  // OR finished at least one game — no manual dismiss needed.
  const gamesPlayed = useStatsStore(s => s.stats.wins + s.stats.losses);
  const showIntroCard = !tutorialSeen() && gamesPlayed === 0;

  // The three mode cards — identical at every tier; only their
  // container's column count (4-across desk, 2×2 tablet/phone) differs.
  const modeCards = (
    <>
      <Link to="/play" className={styles.modeCard}>
        <span className={styles.modeTitle}>Free Play</span>
        {/* Phone trims the blurb (shorter cards → no vertical scroll). */}
        <span className={styles.modeBlurb}>
          {isPhone
            ? 'Pick any difficulty and play as many grids as you would like.'
            : "Pick any difficulty and play as many boards as you like. Doesn't touch the daily leaderboard."}
        </span>
        <span className={styles.modeLink}>Choose a difficulty →</span>
      </Link>
      <Link to="/challenges" className={styles.modeCard}>
        <span className={styles.modeTitle}>Challenges</span>
        <span className={styles.modeBlurb}>
          {isPhone
            ? 'Ten twisted rule sets — No Discards, Short Deck, Poker Purist, etc.'
            : 'Ten twisted rule sets — No Discards, Short Deck, Poker Purist and more. Beat them all for the sweep.'}
        </span>
        <span className={styles.modeLink}>{CHALLENGES.length} modes to beat →</span>
      </Link>
      <Link to="/stats" className={styles.modeCard}>
        <span className={styles.modeTitle}>Stats</span>
        <span className={styles.modeBlurb}>
          {isPhone
            ? 'Scores, win rates, and tier ratings; filter by difficulty and mode.'
            : 'Best scores, win rate, and tier ratings by difficulty, filtered by mode and level.'}
        </span>
        <span className={styles.modeLink}>See your stats →</span>
      </Link>
    </>
  );

  return (
    <div className={styles.wrap}>
      {/* TOP ROW — the hero + Quick Start share it on desk widths (the
          hero's card art slides left as it narrows); below 1024 the row
          dissolves and Quick Start drops to the page foot (flex order). */}
      <div className={styles.topRow}>
      {/* HERO — today's daily. A <div> with a stretched primary link
          (the CTA's ::after covers the card) instead of one big <a>,
          so the quiet archive link can sit beside the CTA without
          nesting anchors. */}
      <div className={styles.hero}>
        <div className={styles.heroBody}>
          <div className={styles.heroEyebrow}>
            <span className={styles.heroKicker}>The Daily Grid</span>
            <span className={styles.heroDot} aria-hidden="true" />
            <span className={styles.heroDate}>{heroDate(today)}</span>
          </div>
          <h1 className={styles.heroTitle}>
            One grid.
            <br />
            Same for everyone.
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
            {/* Phone hides the streak chip — the hero stays compact above
                the CTA. Desktop keeps it. */}
            {!isPhone && streak.current > 0 && (
              <span className={styles.streakChip}>
                🔥 {streak.current}-day streak
              </span>
            )}
          </div>
          <div
            className={`${styles.heroCtaRow} ${
              todayResult && todayTier ? styles.heroCtaRowResult : ''
            }`}
          >
            {todayResult && todayTier ? (
              // Already played today's grid — show the result (score /
              // target + tier badge + link to the full stored result),
              // exactly as a completed day reads in the archive.
              <div className={styles.heroResult}>
                <span className={styles.heroResultScore}>
                  {todayResult.score}
                </span>
                <span className={styles.heroResultTarget}>/ {target}</span>
                <span
                  className={styles.heroResultBadge}
                  style={
                    { '--tier-tone': TIER_TONE[todayTier] } as CSSProperties
                  }
                >
                  {todayTier}
                </span>
                <Link to={`/daily/${today}`} className={styles.heroResultLink}>
                  View full result →
                </Link>
              </div>
            ) : (
              <Link to="/daily" className={styles.heroCta}>
                {/* Phone shortens the label so the compact button stays on
                    one line in the narrowed left column. */}
                {isPhone ? 'Play now' : "Play today's puzzle"}{' '}
                <span aria-hidden="true">→</span>
              </Link>
            )}
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

      {/* Quick Start: one-tap Free Play at any difficulty. The hero's
          right-hand neighbor on desk widths (buttons stacked); the full-
          width strip below the card grid everywhere else. */}
      <div className={styles.quickStart}>
        <div className={styles.quickStartHead}>
          <span className={styles.quickStartTitle}>Quick Start</span>
          <span className={styles.quickStartSub}>
            Jump right into a Free Play game.
          </span>
        </div>
        <div className={styles.quickRow}>
          {QUICK_DIFFS.map(d => (
            <Link
              key={d}
              to={`/play?difficulty=${d}`}
              className={styles.quickBtn}
              style={{ '--tone': difficultyColors[d] } as CSSProperties}
            >
              {DIFF_LABEL[d]}
            </Link>
          ))}
        </div>
      </div>
      </div>

      {/* CARD GRID — the three mode cards + the newcomer card (the
          tutorial callout on a first visit, the quiet rules pointer
          ever after). One row of four on desk widths, 2×2 below. */}
      <div className={styles.cardGrid}>
        {modeCards}
        {showIntroCard ? (
          <div className={styles.footerCard}>
            <span className={styles.modeTitle}>New here?</span>
            <span className={styles.modeBlurb}>
              Play a guided practice deal that walks you through every move.
            </span>
            <Link to="/tutorial" className={styles.modeLink}>
              Start the tutorial →
            </Link>
          </div>
        ) : (
          <div className={styles.footerCard}>
            <span className={styles.modeTitle}>Rules</span>
            <span className={styles.modeBlurb}>
              The whole game is 25 cards, 10 poker hands, one target.
            </span>
            <Link to="/rules" className={styles.modeLink}>
              Read the rules →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
