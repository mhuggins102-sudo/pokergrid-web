import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';
import { ToastProvider } from '../../../design/primitives';
import type { Difficulty } from '../../../game/rules';
import { EMPTY_STATS } from '../../../lib/stats';
import { useStatsStore } from '../../progress/statsStore';
import { DailyDatePage } from '../DailyDatePage';
import type { DailyPlay } from '../sync/playsStore';
import { usePlaysStore } from '../sync/playsStore';

// Naive Place-only play scores ~30-110 — far under any real daily
// target — so pin the target low enough that the scripted run wins.
// Everything else (recipe, deal, reducer, recording) is the real thing.
vi.mock('../../../game/daily/recipe', async importOriginal => ({
  ...(await importOriginal<object>()),
  dailyTargetFor: () => 10,
}));

const play = (
  dateISO: string,
  won: boolean,
  difficulty: Difficulty = 'medium'
): DailyPlay =>
  ({
    dateISO,
    won,
    score: won ? 500 : 100,
    completedAt: 0,
    recipe: { difficulty },
    state: { target: 450, bonusCards: [], bonusDeck: [] },
  }) as unknown as DailyPlay;

describe('daily finish surfaces cumulative achievements (end-to-end)', () => {
  it('shows the 🏆 callout for a streak completed by an archive fill-in', () => {
    // The reported scenario, shifted onto real archive dates: 03-01 and
    // 03-03 are won, 03-05 was lost; winning 03-02 retroactively
    // completes the 1-2-3 run and must toast "On a Roll" on the result
    // screen (2026-03-02 rolls no twist, so the run is Place-only).
    usePlaysStore.setState({
      plays: {
        '2026-03-01': play('2026-03-01', true),
        '2026-03-03': play('2026-03-03', true),
        '2026-03-05': play('2026-03-05', false),
      },
    });
    useStatsStore.setState({
      stats: { ...EMPTY_STATS, achievementsDone: ['daily-first'] },
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/daily/2026-03-02']}>
            <Routes>
              <Route path="/daily/:date" element={<DailyDatePage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

    // The masthead intro's CTA ("Play this puzzle" for archive dates,
    // "Play today's puzzle" for today).
    fireEvent.click(
      screen.getByRole('button', { name: /^Play (today's|this) puzzle$/ })
    );
    for (let i = 0; i < 30; i++) {
      const placeBtn = screen.queryByRole('button', { name: 'Place' });
      if (!placeBtn) break;
      fireEvent.click(placeBtn);
    }

    // The run finished and won against the pinned target...
    expect(screen.getByTestId('final-score')).toBeInTheDocument();
    expect(usePlaysStore.getState().plays['2026-03-02']?.won).toBe(true);

    // ...and the LIVE result screen is still up (the entry-time
    // snapshot keeps DailyDay from swapping to the static replay view)
    // with the newly earned streak achievement in the 🏆 callout.
    expect(screen.getByRole('button', { name: 'On a Roll' })).toBeInTheDocument();
    // Daily Debut was already earned — it must not re-announce.
    expect(screen.queryByText('Daily Debut')).toBeNull();
    // Persisted too, exactly once.
    const done = useStatsStore.getState().stats.achievementsDone;
    expect(done.filter(id => id === 'daily-streak-3')).toEqual([
      'daily-streak-3',
    ]);
  });
});
