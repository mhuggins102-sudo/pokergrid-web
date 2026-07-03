import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { ToastProvider } from '../../../design/primitives';
import { RankPanel } from '../RankPanel';

vi.mock('../../../lib/supabaseRpc', async importOriginal => ({
  ...(await importOriginal<object>()),
  isBackendConfigured: () => true,
}));

// Scores 250,280,340,360,385,399,525,550 → bands 200/300/400/500 with
// counts 2/4/0/2 (the 400s band is empty but still present).
vi.mock('../sync/useDailyRank', () => ({
  useDailyRank: () => ({
    data: { rank: 1, total: 8, score: 550, topPercent: 13 },
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useArchiveRank: () => ({ data: null }),
  useDailyStats: () => ({
    data: { median: 372, total: 8, winRatePct: 25, topScores: [] },
  }),
  useDailyHistogram: () => ({
    data: {
      bins: [
        { lo: 200, hi: 299, count: 2 },
        { lo: 300, hi: 399, count: 4 },
        { lo: 400, hi: 499, count: 0 },
        { lo: 500, hi: 599, count: 2 },
      ],
      median: 372,
      min: 250,
      max: 550,
      total: 8,
    },
  }),
}));

describe('daily score distribution (fixed 100-point bands)', () => {
  it('renders every band including empty interiors, labeled by band start', () => {
    render(
      <ToastProvider>
        <RankPanel dateISO="2026-07-02" />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: /Leaderboard/ }));

    // Axis labels at 100 increments (≤6 bands → every band labeled).
    for (const label of ['200', '300', '400', '500']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    // Four slots; the empty 400s band renders a slot with NO bar.
    const slots = document.querySelectorAll('[class*=histoSlot]');
    expect(slots).toHaveLength(4);
    expect(slots[2].querySelector('[class*=histoBar]')).toBeNull();
    expect(slots[1].querySelector('[class*=histoBar]')).not.toBeNull();

    // Heights are proportional to count (max count 4 → 100%).
    const tall = slots[1].querySelector('[class*=histoBar]') as HTMLElement;
    const half = slots[0].querySelector('[class*=histoBar]') as HTMLElement;
    expect(tall.style.height).toBe('100%');
    expect(half.style.height).toBe('50%');
  });
});
