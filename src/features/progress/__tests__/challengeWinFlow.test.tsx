import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ToastProvider } from '../../../design/primitives';
import { EMPTY_STATS } from '../../../lib/stats';
import { useStatsStore } from '../statsStore';
import { ChallengePlayPage } from '../../challenges/ChallengePlayPage';

// Place-spam tops out around ~110 points, far below any real challenge
// target — so drop the target to 40 to reach the WIN path for real:
// challengeWon fires, the tier records, and the popup shows the trophy
// callout. Purist's flat tierDeltas ladder is stripped along with the
// target (this test exercises the trophy FLOW on the generic ratio
// path; the ladder itself is covered in statsTiers.test.ts).
// Everything else about the module stays live.
vi.mock('../../../game/challenges', async importOriginal => {
  const real =
    await importOriginal<typeof import('../../../game/challenges')>();
  return {
    ...real,
    findChallenge: (id: Parameters<typeof real.findChallenge>[0]) => ({
      ...real.findChallenge(id),
      scoreTarget: 40,
      tierDeltas: undefined,
    }),
  };
});

const renderAt = (path: string) =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/challenges/:id" element={<ChallengePlayPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );

const placeToEnd = () => {
  for (let i = 0; i < 40; i++) {
    const place = screen.queryByRole('button', { name: 'Place' });
    if (!place) break;
    fireEvent.click(place);
  }
};

beforeEach(() => {
  localStorage.clear();
  useStatsStore.setState({ stats: EMPTY_STATS });
});

describe('challenge win → trophy flow', () => {
  it('first win records the tier and the popup announces the trophy', () => {
    // Seed 57 place-spams to ~104 on the Purist config → 104/40 ≥ 1.6
    // → SS tier → gold.
    renderAt('/challenges/poker-purist?seed=57');
    placeToEnd();
    expect(screen.getByText('Challenge beaten')).toBeInTheDocument();
    expect(screen.getByText(/Gold trophy earned/)).toBeInTheDocument();
    const stats = useStatsStore.getState().stats;
    expect(stats.challengesDone).toContain('poker-purist');
    expect(stats.challengeTiers['poker-purist']).toBe('SS');
  });

  it('a win above the stored tier announces the upgrade', () => {
    useStatsStore.getState().recordChallenge('poker-purist', 'A');
    renderAt('/challenges/poker-purist?seed=57');
    placeToEnd();
    expect(screen.getByText(/Trophy upgraded to gold/)).toBeInTheDocument();
    expect(
      useStatsStore.getState().stats.challengeTiers['poker-purist']
    ).toBe('SS');
  });

  it('a repeat win at the same tier stays quiet', () => {
    useStatsStore.getState().recordChallenge('poker-purist', 'SS');
    renderAt('/challenges/poker-purist?seed=57');
    placeToEnd();
    // Repeat wins get the quieter "Challenge beaten" verdict.
    expect(screen.getByText('Challenge beaten')).toBeInTheDocument();
    expect(screen.queryByText(/trophy earned/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Trophy upgraded/)).not.toBeInTheDocument();
  });
});
