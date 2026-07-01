import { CHALLENGES } from '../../game/challenges';
import { EMPTY_STATS, Stats, hydrateStats } from '../stats';

describe('hydrateStats → challengesDone', () => {
  it('keeps every id in the live challenge catalog', () => {
    // Regression: scatter and bull-market were once missing from the
    // known-id filter, so beating them didn't survive a reload.
    const persisted: Partial<Stats> = {
      ...EMPTY_STATS,
      challengesDone: CHALLENGES.map(c => c.id),
    };
    expect(hydrateStats(persisted).challengesDone).toEqual(
      CHALLENGES.map(c => c.id)
    );
  });

  it('migrates legacy challenge ids into achievements and drops unknowns', () => {
    const persisted = {
      ...EMPTY_STATS,
      challengesDone: ['dynamite', 'no-longer-a-thing', 'short-deck'],
    } as unknown as Partial<Stats>;
    const hydrated = hydrateStats(persisted);
    expect(hydrated.challengesDone).toEqual(['short-deck']);
    expect(hydrated.achievementsDone).toContain('dynamite');
    expect(hydrated.challengesDone).not.toContain('no-longer-a-thing');
  });
});
