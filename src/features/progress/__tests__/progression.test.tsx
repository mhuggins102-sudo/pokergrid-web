import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ToastProvider } from '../../../design/primitives';
import { CHALLENGES } from '../../../game/challenges';
import { EMPTY_STATS } from '../../../lib/stats';
import { useStatsStore } from '../statsStore';
import { useTargetsStore } from '../../targets/targetsStore';
import { PlayPage } from '../../game/PlayPage';
import { ChallengesPage } from '../../challenges/ChallengesPage';
import { ChallengePlayPage } from '../../challenges/ChallengePlayPage';
import { TargetsPlayPage } from '../../targets/TargetsPlayPage';

const renderAt = (path: string) =>
  render(
    <ToastProvider><MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/play" element={<PlayPage />} />
        <Route path="/challenges" element={<ChallengesPage />} />
        <Route path="/challenges/:id" element={<ChallengePlayPage />} />
        <Route path="/targets/play" element={<TargetsPlayPage />} />
        <Route path="/targets" element={<div>targets home</div>} />
        <Route path="/" element={<div>home</div>} />
      </Routes>
    </MemoryRouter></ToastProvider>
  );

const placeToEnd = () => {
  for (let i = 0; i < 30; i++) {
    const place = screen.queryByRole('button', { name: 'Place' });
    if (!place) break;
    fireEvent.click(place);
  }
};

beforeEach(() => {
  localStorage.clear();
  useStatsStore.setState({ stats: EMPTY_STATS });
  useTargetsStore.setState({ save: null });
});

describe('progression recording', () => {
  it('records a free-play run into stats with a tier', () => {
    renderAt('/play?difficulty=easy&seed=42');
    placeToEnd();
    expect(screen.getByTestId('final-score')).toBeInTheDocument();

    const stats = useStatsStore.getState().stats;
    expect(stats.wins + stats.losses).toBe(1);
    expect(stats.recent).toHaveLength(1);
    expect(stats.recent[0].difficulty).toBe('easy');
    const tierTotal = Object.values(stats.tierCounts.easy).reduce(
      (a, b) => a + b,
      0
    );
    expect(tierTotal).toBe(1);
    // The result hero shows the tier.
    expect(screen.getByText(/tier (SS|S|A|B|C|D)/)).toBeInTheDocument();
  });

  it('does not double-record on re-render', () => {
    renderAt('/play?difficulty=easy&seed=42');
    placeToEnd();
    // Open + close the lines sheet to force re-renders.
    fireEvent.click(screen.getAllByRole('button', { name: /R1/ })[0]);
    const stats = useStatsStore.getState().stats;
    expect(stats.recent).toHaveLength(1);
  });
});

describe('challenges', () => {
  it('runs a challenge on the hard ruleset with its own goal', () => {
    renderAt('/challenges/poker-purist?seed=5');
    // Poker Purist: no bonus cards at all — strip absent.
    expect(screen.queryByLabelText('Bonus cards')).not.toBeInTheDocument();
    expect(screen.getByText(/\/ 350/)).toBeInTheDocument();
    placeToEnd();
    // Place-only never reaches 350 — the failed verdict shows.
    expect(screen.getByText(/Poker Purist — failed/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Retry challenge' })
    ).toBeInTheDocument();
    expect(useStatsStore.getState().stats.challengesDone).toHaveLength(0);
  });

  it('every challenge is playable; beaten ones stay marked', () => {
    useStatsStore.getState().recordChallenge('short-circuit');
    renderAt('/challenges');
    expect(screen.getByText('✓ Beaten')).toBeInTheDocument();
    // No lock gating — every catalog card carries a Play link.
    expect(screen.queryByText('Locked')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Play' })).toHaveLength(
      CHALLENGES.length
    );
  });

  it('three-tricks seeds three one-time specials', () => {
    renderAt('/challenges/three-tricks?seed=9');
    const strip = screen.getAllByLabelText('Bonus cards')[0];
    const chips = strip.querySelectorAll('button[aria-label^="Bonus card:"]');
    expect(chips.length).toBe(3);
  });
});

describe('targets up', () => {
  it('a loss ends the run and clears the save', () => {
    useTargetsStore
      .getState()
      .saveProgress(3, 2, [], [], null);
    renderAt('/targets/play?seed=11');
    expect(screen.getByText(/\/ 450/)).toBeInTheDocument(); // L3 → 450
    placeToEnd();
    expect(screen.getByText(/Run over at level 3/)).toBeInTheDocument();
    expect(useTargetsStore.getState().save).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Back to Targets Up' })
    ).toBeInTheDocument();
  });
});
