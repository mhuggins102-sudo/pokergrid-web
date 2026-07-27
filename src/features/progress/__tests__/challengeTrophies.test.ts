import { ACHIEVEMENTS, MilestoneInputs } from '../../../game/achievements';
import {
  EMPTY_STATS,
  isBetterTier,
  trophyForTier,
} from '../../../lib/stats';
import { useStatsStore } from '../statsStore';

beforeEach(() => {
  // Node test env (no localStorage) — safeJSONStorage no-ops persistence,
  // so resetting the in-memory store is all the isolation needed.
  useStatsStore.setState({ stats: EMPTY_STATS });
});

describe('challenge trophies', () => {
  it('maps win tiers to metals (and loss tiers to none)', () => {
    expect(trophyForTier('SS')).toBe('gold');
    expect(trophyForTier('S')).toBe('silver');
    expect(trophyForTier('A')).toBe('bronze');
    expect(trophyForTier('B')).toBeNull();
    expect(trophyForTier('C')).toBeNull();
    expect(trophyForTier('D')).toBeNull();
  });

  it('recordChallenge stores the tier and only ever upgrades it', () => {
    const store = useStatsStore.getState();
    store.recordChallenge('short-deck', 'A');
    expect(useStatsStore.getState().stats.challengeTiers['short-deck']).toBe(
      'A'
    );
    // A repeat win at a lower/equal tier never downgrades…
    useStatsStore.getState().recordChallenge('short-deck', 'A');
    expect(useStatsStore.getState().stats.challengeTiers['short-deck']).toBe(
      'A'
    );
    // …an SS win upgrades…
    useStatsStore.getState().recordChallenge('short-deck', 'SS');
    expect(useStatsStore.getState().stats.challengeTiers['short-deck']).toBe(
      'SS'
    );
    // …and a later S win can't pull it back down.
    useStatsStore.getState().recordChallenge('short-deck', 'S');
    expect(useStatsStore.getState().stats.challengeTiers['short-deck']).toBe(
      'SS'
    );
    expect(isBetterTier('SS', 'S')).toBe(true);
    expect(isBetterTier('S', 'SS')).toBe(false);
  });

  it('legacy tier-less recording still marks the challenge beaten', () => {
    useStatsStore.getState().recordChallenge('gridlock');
    const stats = useStatsStore.getState().stats;
    expect(stats.challengesDone).toContain('gridlock');
    expect(stats.challengeTiers['gridlock']).toBeUndefined();
  });

  it('the two trophy achievements sit beneath Challenge Sweep and count correctly', () => {
    const ids = ACHIEVEMENTS.map(a => a.id);
    const sweep = ids.indexOf('all-challenges');
    expect(ids[sweep + 1]).toBe('challenge-trophies-5');
    expect(ids[sweep + 2]).toBe('challenge-golds-3');

    const milestone = (over: Partial<MilestoneInputs>): MilestoneInputs => ({
      winsByDifficulty: { easy: 0, medium: 0, hard: 0, extreme: 0 },
      ssByDifficulty: { easy: 0, medium: 0, hard: 0, extreme: 0 },
      totalWins: 0,
      challengesCompleted: 0,
      totalChallenges: 11,
      challengeSilverPlus: 0,
      challengeGold: 0,
      runBonusShapley: [],
      runWasFreePlay: false,
      uniqueBonusCardsScored: 0,
      totalBonusCardsInPool: 0,
      ...over,
    });
    const ctxWith = (over: Partial<MilestoneInputs>) =>
      ({ milestone: milestone(over) }) as Parameters<
        (typeof ACHIEVEMENTS)[number]['conditionMet']
      >[0];

    const trophyCase = ACHIEVEMENTS.find(a => a.id === 'challenge-trophies-5')!;
    expect(trophyCase.conditionMet(ctxWith({ challengeSilverPlus: 6 }))).toBe(
      false
    );
    expect(trophyCase.conditionMet(ctxWith({ challengeSilverPlus: 7 }))).toBe(
      true
    );

    const goldStandard = ACHIEVEMENTS.find(a => a.id === 'challenge-golds-3')!;
    expect(goldStandard.conditionMet(ctxWith({ challengeGold: 4 }))).toBe(false);
    expect(goldStandard.conditionMet(ctxWith({ challengeGold: 5 }))).toBe(true);
  });
});
