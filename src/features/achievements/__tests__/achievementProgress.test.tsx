import { fireEvent, render, screen } from '@testing-library/react';
import { LIVE_CHALLENGES } from '../../../game/challenges';
import { BONUS_DECK_POOL } from '../../../game/bonusCards';
import type { Difficulty } from '../../../game/rules';
import { EMPTY_STATS, Stats } from '../../../lib/stats';
import type { DailyPlay, DailyPlaysMap } from '../../daily/sync/playsStore';
import { usePlaysStore } from '../../daily/sync/playsStore';
import { useStatsStore } from '../../progress/statsStore';
import { achievementProgressMap } from '../achievementProgress';
import { AchievementsPage } from '../AchievementsPage';

/* Minimal daily play — only the fields the aggregators read (dateISO,
   won, score, recipe.difficulty, state.target). */
const play = (
  dateISO: string,
  won: boolean,
  opts: { difficulty?: Difficulty; score?: number; target?: number } = {}
): DailyPlay => ({
  dateISO,
  score: opts.score ?? 100,
  won,
  recipe: { difficulty: opts.difficulty ?? 'medium' } as DailyPlay['recipe'],
  completedAt: 0,
  state: { target: opts.target ?? 100 } as DailyPlay['state'],
});

const playsOf = (...items: DailyPlay[]): DailyPlaysMap =>
  Object.fromEntries(items.map(p => [p.dateISO, p]));

const statsWith = (patch: Partial<Stats>): Stats => ({
  ...EMPTY_STATS,
  ...patch,
});

describe('achievementProgressMap', () => {
  it('reports zeros from an empty save', () => {
    const map = achievementProgressMap(EMPTY_STATS, {});
    expect(map['daily-20']?.text).toBe('0 / 20 daily puzzles won');
    expect(map['daily-streak-10']?.text).toBe(
      'Best streak: 0 daily wins in a row — need 10'
    );
    expect(map['all-challenges']?.text).toBe(
      `0 / ${LIVE_CHALLENGES.length} challenges beaten`
    );
    expect(map['challenge-trophies-5']?.text).toBe(
      '0 / 5 challenges at silver or gold'
    );
    expect(map['challenge-golds-3']?.text).toBe('0 / 3 gold trophies');
    expect(map['win-every-difficulty']?.text).toBe(
      'No win yet at: Easy, Medium, Hard, Extreme'
    );
    expect(map['perfect-every-difficulty']?.text).toBe(
      'No SS win yet at: Easy, Medium, Hard, Extreme'
    );
    expect(map['wins-25']?.text).toBe('0 / 25 wins');
    expect(map['wins-100']?.text).toBe('0 / 100 wins');
    expect(map['full-bonus-hand']?.text).toBe(
      `0 / ${BONUS_DECK_POOL.length} bonus cards scored`
    );
    expect(map['full-bonus-hand']?.detail).toBeUndefined();
  });

  it('counts daily wins and the best CALENDAR streak (gaps and losses break it)', () => {
    const plays = playsOf(
      play('2026-01-01', true),
      play('2026-01-02', true),
      play('2026-01-03', true),
      play('2026-01-04', false), // loss breaks the run
      play('2026-01-06', true) // gap before it — isolated win
    );
    const map = achievementProgressMap(EMPTY_STATS, plays);
    expect(map['daily-20']?.text).toBe('4 / 20 daily puzzles won');
    expect(map['daily-streak-10']?.text).toBe(
      'Best streak: 3 daily wins in a row — need 10'
    );
  });

  it('uses the singular for a best streak of one', () => {
    const map = achievementProgressMap(
      EMPTY_STATS,
      playsOf(play('2026-01-01', true))
    );
    expect(map['daily-streak-10']?.text).toBe(
      'Best streak: 1 daily win in a row — need 10'
    );
  });

  it('combines wins from every mode for the win milestones', () => {
    // 12 free-play + 2 daily + 1 challenge beaten + a best Targets Up
    // run that cleared 2 levels = 17.
    const plays = playsOf(play('2026-01-01', true), play('2026-01-03', true));
    const stats = statsWith({
      wins: 12,
      challengesDone: [LIVE_CHALLENGES[0].id],
      targetsUpBest: 2,
    });
    const map = achievementProgressMap(stats, plays);
    expect(map['wins-25']?.text).toBe('17 / 25 wins');
    expect(map['wins-100']?.text).toBe('17 / 100 wins');
  });

  it('derives challenge counts from beaten ids and best-win tiers', () => {
    const [a, b, c] = LIVE_CHALLENGES;
    const stats = statsWith({
      challengesDone: [a.id, b.id, c.id],
      challengeTiers: { [a.id]: 'SS', [b.id]: 'S', [c.id]: 'A' },
    });
    const map = achievementProgressMap(stats, {});
    expect(map['all-challenges']?.text).toBe(
      `3 / ${LIVE_CHALLENGES.length} challenges beaten`
    );
    expect(map['challenge-trophies-5']?.text).toBe(
      '2 / 5 challenges at silver or gold'
    );
    expect(map['challenge-golds-3']?.text).toBe('1 / 3 gold trophies');
  });

  it('lists only the missing difficulties, counting dailies too', () => {
    const stats = statsWith({
      byDifficulty: {
        ...EMPTY_STATS.byDifficulty,
        easy: { ...EMPTY_STATS.byDifficulty.easy, wins: 2 },
      },
      tierCounts: {
        ...EMPTY_STATS.tierCounts,
        easy: { ...EMPTY_STATS.tierCounts.easy, SS: 1 },
      },
    });
    // A daily SS win at medium: won at 1.6× the target.
    const plays = playsOf(
      play('2026-01-01', true, { difficulty: 'medium', score: 160, target: 100 })
    );
    const map = achievementProgressMap(stats, plays);
    expect(map['win-every-difficulty']?.text).toBe(
      'No win yet at: Hard, Extreme'
    );
    expect(map['perfect-every-difficulty']?.text).toBe(
      'No SS win yet at: Hard, Extreme'
    );
  });

  it('omits the missing-difficulty entries once all four are covered', () => {
    const stats = statsWith({
      byDifficulty: Object.fromEntries(
        (['easy', 'medium', 'hard', 'extreme'] as const).map(d => [
          d,
          { ...EMPTY_STATS.byDifficulty[d], wins: 1 },
        ])
      ) as Stats['byDifficulty'],
    });
    const map = achievementProgressMap(stats, {});
    expect(map['win-every-difficulty']).toBeUndefined();
  });

  it('names the remaining bonus cards only when 5 or fewer are left', () => {
    const scoredAllBut = (n: number): Stats =>
      statsWith({
        bonusCardStats: Object.fromEntries(
          BONUS_DECK_POOL.slice(n).map(card => [
            card.id,
            { timesHeld: 1, totalShapley: 5 },
          ])
        ),
      });
    const total = BONUS_DECK_POOL.length;

    const six = achievementProgressMap(scoredAllBut(6), {});
    expect(six['full-bonus-hand']?.text).toBe(
      `${total - 6} / ${total} bonus cards scored`
    );
    expect(six['full-bonus-hand']?.detail).toBeUndefined();

    const three = achievementProgressMap(scoredAllBut(3), {});
    expect(three['full-bonus-hand']?.text).toBe(
      `${total - 3} / ${total} bonus cards scored`
    );
    expect(three['full-bonus-hand']?.detail).toBe(
      `Still needed: ${BONUS_DECK_POOL.slice(0, 3)
        .map(card => card.title)
        .join(', ')}`
    );
  });

  it('ignores zero-shapley and stale bonus-card entries', () => {
    const stats = statsWith({
      bonusCardStats: {
        // Held but never actually scored with — doesn't count.
        [BONUS_DECK_POOL[0].id]: { timesHeld: 3, totalShapley: 0 },
        // Stale id outside the pool — can't inflate the count.
        'not-a-card': { timesHeld: 1, totalShapley: 9 },
      },
    });
    const map = achievementProgressMap(stats, {});
    expect(map['full-bonus-hand']?.text).toBe(
      `0 / ${BONUS_DECK_POOL.length} bonus cards scored`
    );
  });
});

/* jsdom renders the phone tree (useTier contract), so each tier section
   is a closed accordion — open one to mount its card grid. */
describe('AchievementsPage progress popovers', () => {
  beforeEach(() => {
    localStorage.clear();
    useStatsStore.setState({ stats: EMPTY_STATS });
    usePlaysStore.setState({ plays: {} });
  });

  const openSection = (name: RegExp) =>
    fireEvent.click(screen.getByRole('button', { name }));

  it('exposes a progress tooltip on every unearned cumulative card', () => {
    render(<AchievementsPage />);
    expect(screen.queryAllByRole('tooltip')).toHaveLength(0);

    openSection(/Daily Grids/);
    expect(screen.getAllByRole('tooltip')).toHaveLength(2);
    expect(screen.getByText('0 / 20 daily puzzles won')).toBeInTheDocument();

    // Single-open accordion: opening Milestones closes Daily Grids.
    openSection(/Milestones/);
    expect(screen.getAllByRole('tooltip')).toHaveLength(5);
    expect(screen.getByText('0 / 25 wins')).toBeInTheDocument();
  });

  it('drops the popover once the achievement is earned', () => {
    useStatsStore.setState({
      stats: statsWith({ achievementsDone: ['daily-20'] }),
    });
    render(<AchievementsPage />);
    openSection(/Daily Grids/);
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
    expect(screen.queryByText('0 / 20 daily puzzles won')).toBeNull();
  });
});
