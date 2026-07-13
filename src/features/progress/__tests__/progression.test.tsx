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
    // The streamlined result dialog is shown with the run's verdict.
    expect(screen.getByText(/Target cleared|Just short/)).toBeInTheDocument();
  });

  it('does not double-record on re-render', () => {
    renderAt('/play?difficulty=easy&seed=42');
    placeToEnd();
    // Toggle the result dialog (View Grid → the finished board) to force a
    // re-render; recording must not fire a second time.
    fireEvent.click(screen.getByRole('button', { name: 'View Grid' }));
    const stats = useStatsStore.getState().stats;
    expect(stats.recent).toHaveLength(1);
  });
});

describe('challenges', () => {
  it('runs a challenge on the hard ruleset with its own goal', () => {
    renderAt('/challenges/poker-purist?seed=5');
    // Poker Purist: no bonus cards at all — strip absent. (The 350 target
    // lives in the header pill, mounted into the nav — not in this harness.)
    expect(screen.queryByLabelText('Bonus cards')).not.toBeInTheDocument();
    placeToEnd();
    // Place-only never reaches 350 — the failed verdict shows in the
    // result dialog (verdict line + the ✦ challenge name).
    expect(screen.getByText('Challenge missed')).toBeInTheDocument();
    expect(screen.getByText(/Poker Purist/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Retry challenge' })
    ).toBeInTheDocument();
    expect(useStatsStore.getState().stats.challengesDone).toHaveLength(0);
  });

  it('every challenge is playable; beaten ones stay marked', () => {
    useStatsStore.getState().recordChallenge('short-circuit');
    renderAt('/challenges');
    // The Beaten badge shows on the collapsed phone card head.
    expect(screen.getByText('✓ Beaten')).toBeInTheDocument();
    // No lock gating anywhere.
    expect(screen.queryByText('Locked')).not.toBeInTheDocument();
    // Phone (jsdom default): cards collapse, so the Play footer lives
    // behind a tap. Expand every card (names are unique), then confirm
    // each still carries exactly one Play link.
    CHALLENGES.forEach(c => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(c.name) }));
    });
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
    // L3 → target 450 (shown in the header pill, mounted into the nav —
    // the verdict below confirms the level reached).
    placeToEnd();
    expect(screen.getByText(/Run ended — level 3/)).toBeInTheDocument();
    expect(useTargetsStore.getState().save).toBeNull();
    // The result dialog's quiet row links back to the Targets Up home.
    expect(
      screen.getByRole('link', { name: 'Targets Up home' })
    ).toBeInTheDocument();
  });
});
