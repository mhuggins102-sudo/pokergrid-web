import { act, renderHook } from '@testing-library/react';
import { ACHIEVEMENTS } from '../../../game/achievements';
import { EMPTY_STATS, Stats } from '../../../lib/stats';
import { usePlaysStore } from '../../daily/sync/playsStore';
import { useProgressionStore } from '../progressionStore';
import { useStatsStore } from '../statsStore';
import {
  useLevelUp,
  usePlayerLevel,
  useSeedProgression,
} from '../usePlayerLevel';

/*
 * The level-up banner's acknowledgement watermark (levelAckd). The
 * curve stretch demoted players whose XP mapped to a higher level
 * under the old LEVEL_XP — a stranded watermark then swallowed their
 * next genuine crossings (reported: 1415 → 1425 XP crossed the new
 * Level 7 threshold with no banner, because levelAckd still said 8).
 */

// Achievements are 100 XP each and targetsUpBest levels 50 each —
// 13 achievements + 2 targets = 1,400 XP (Level 6, threshold 1,020);
// one more achievement = 1,500 XP, crossing Level 7's 1,420.
const statsWith = (achievements: number): Stats => ({
  ...EMPTY_STATS,
  achievementsDone: ACHIEVEMENTS.slice(0, achievements).map(a => a.id),
  targetsUpBest: 2,
});

beforeEach(() => {
  localStorage.clear();
  useStatsStore.setState({ stats: EMPTY_STATS });
  usePlaysStore.setState({ plays: {} });
  useProgressionStore.setState({ levelAckd: null });
});

it('sanity: the seeded stats land at 1,400 XP / Level 6', () => {
  useStatsStore.setState({ stats: statsWith(13) });
  const { result } = renderHook(() => usePlayerLevel());
  expect(result.current.xp).toBe(1400);
  expect(result.current.level).toBe(6);
});

it('heals a watermark stranded above the derived level, then celebrates the next crossing', () => {
  useStatsStore.setState({ stats: statsWith(13) }); // Level 6
  useProgressionStore.setState({ levelAckd: 8 }); // old-curve stranding

  const seed = renderHook(() => useSeedProgression());
  expect(useProgressionStore.getState().levelAckd).toBe(6);
  seed.unmount();

  const { result } = renderHook(() => useLevelUp(false, true));
  expect(result.current).toBeNull();

  act(() => {
    useStatsStore.setState({ stats: statsWith(14) }); // 1,500 XP → Level 7
  });
  expect(result.current).toBe(7);
  expect(useProgressionStore.getState().levelAckd).toBe(7);
});

it('the seeder never RAISES a watermark below the derived level', () => {
  useStatsStore.setState({ stats: statsWith(13) }); // Level 6
  useProgressionStore.setState({ levelAckd: 3 });
  renderHook(() => useSeedProgression());
  expect(useProgressionStore.getState().levelAckd).toBe(3);
});

it('a fresh install seeds to the current level without celebrating', () => {
  useStatsStore.setState({ stats: statsWith(13) }); // Level 6
  renderHook(() => useSeedProgression());
  expect(useProgressionStore.getState().levelAckd).toBe(6);
  const { result } = renderHook(() => useLevelUp(false, true));
  expect(result.current).toBeNull();
});

it('an inactive (closed) dialog neither celebrates nor burns the watermark', () => {
  useStatsStore.setState({ stats: statsWith(14) }); // Level 7
  useProgressionStore.setState({ levelAckd: 6 });

  const { result, rerender } = renderHook(
    ({ active }: { active: boolean }) => useLevelUp(false, active),
    { initialProps: { active: false } }
  );
  expect(result.current).toBeNull();
  expect(useProgressionStore.getState().levelAckd).toBe(6);

  rerender({ active: true });
  expect(result.current).toBe(7);
  expect(useProgressionStore.getState().levelAckd).toBe(7);
});
