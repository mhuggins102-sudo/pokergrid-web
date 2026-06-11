import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../design/primitives';

// Network layer mocked: submits fail (offline) unless flipped, so the
// flow exercises the queue-first path deterministically.
const submitMock = vi.fn(async (..._args: unknown[]) => {
  throw new Error('offline');
});
vi.mock('../../../lib/supabaseRpc', async importOriginal => {
  const actual =
    await importOriginal<typeof import('../../../lib/supabaseRpc')>();
  return {
    ...actual,
    isBackendConfigured: () => true,
    submitDailyPlay: (...args: unknown[]) => submitMock(...args),
    fetchRank: vi.fn(async () => null),
  };
});

import { DailyDatePage } from '../DailyDatePage';
import { DailyArchivePage } from '../DailyArchivePage';
import { usePlaysStore } from '../sync/playsStore';
import { resetDrainGuardForTests, useQueueStore } from '../sync/queue';

const DATE = '2026-06-01';

const renderAt = (path: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/daily/archive" element={<DailyArchivePage />} />
            <Route path="/daily/:date" element={<DailyDatePage />} />
            <Route path="/daily" element={<div>daily home</div>} />
            <Route path="/" element={<div>home</div>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );

beforeEach(() => {
  localStorage.clear();
  usePlaysStore.setState({ plays: {} });
  useQueueStore.setState({ pending: [] });
  resetDrainGuardForTests();
  submitMock.mockClear();
});

describe('daily flow', () => {
  it('plays a past date: intro → seeded game → recorded locally + queued', async () => {
    renderAt(`/daily/${DATE}`);

    // Intro card shows the recipe, then starts the seeded game.
    expect(screen.getByText(DATE)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByRole('grid', { name: 'Game board' })).toBeInTheDocument();

    for (let i = 0; i < 30; i++) {
      const place = screen.queryByRole('button', { name: 'Place' });
      if (!place) break;
      fireEvent.click(place);
    }
    expect(screen.getByTestId('final-score')).toBeInTheDocument();
    expect(screen.getByText(/Daily solved|Daily missed/)).toBeInTheDocument();

    // Local play is the source of truth…
    const play = usePlaysStore.getState().plays[DATE];
    expect(play).toBeDefined();
    expect(play.dateISO).toBe(DATE);
    // …and the durable queue entry exists even though the submit
    // failed (queue-first: enqueue happens before the network).
    expect(submitMock).toHaveBeenCalled();
    expect(useQueueStore.getState().pending).toHaveLength(1);
    expect(useQueueStore.getState().pending[0].dateISO).toBe(DATE);
    // The rank panel surfaces the retryable submitting state.
    expect(await screen.findByText(/submitting to the leaderboard/i)).toBeInTheDocument();
  });

  it('is deterministic: the same date deals the same board', () => {
    const scores: string[] = [];
    for (let run = 0; run < 2; run++) {
      usePlaysStore.setState({ plays: {} });
      const view = renderAt(`/daily/${DATE}`);
      fireEvent.click(view.getByRole('button', { name: 'Play' }));
      for (let i = 0; i < 30; i++) {
        const place = view.queryByRole('button', { name: 'Place' });
        if (!place) break;
        fireEvent.click(place);
      }
      scores.push(view.getByTestId('final-score').textContent ?? '');
      view.unmount();
    }
    expect(scores[0]).toBe(scores[1]);
    expect(scores[0]).not.toBe('');
  });

  it('a played date renders the stored result on revisit', () => {
    // Seed a stored play directly, then visit the date.
    const view = renderAt(`/daily/${DATE}`);
    fireEvent.click(view.getByRole('button', { name: 'Play' }));
    for (let i = 0; i < 30; i++) {
      const place = view.queryByRole('button', { name: 'Place' });
      if (!place) break;
      fireEvent.click(place);
    }
    const score = view.getByTestId('final-score').textContent;
    view.unmount();

    renderAt(`/daily/${DATE}`);
    // No Play button — straight to the stored result.
    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
    expect(screen.getByTestId('final-score')).toHaveTextContent(score ?? '');
    expect(screen.getByText('Daily archive')).toBeInTheDocument();
  });

  it('archive lists played scores and playable dates', () => {
    renderAt('/daily/archive');
    expect(screen.getByText('Today')).toBeInTheDocument();
    // Every date back to the 2026-05-01 launch, all playable when
    // nothing's been played.
    expect(screen.getAllByText('Play').length).toBeGreaterThanOrEqual(40);
  });

  it('future dates bounce to today', () => {
    renderAt('/daily/2999-01-01');
    expect(screen.getByText('daily home')).toBeInTheDocument();
  });
});
