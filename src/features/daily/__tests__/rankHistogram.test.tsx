import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { ToastProvider } from '../../../design/primitives';
import { KEY_HANDLE } from '../sync/deviceId';
import { RankPanel } from '../RankPanel';

vi.mock('../../../lib/supabaseRpc', async importOriginal => ({
  ...(await importOriginal<object>()),
  isBackendConfigured: () => true,
}));

// Scores deliberately avoid the histogram tick labels (250/350/450/550)
// so getByText stays unambiguous.
const topScores = [
  { rank: 1, displayName: 'ace', score: 551, isOwn: false },
  { rank: 2, displayName: 'bee', score: 471, isOwn: false },
  { rank: 3, displayName: 'cee', score: 441, isOwn: false },
  { rank: 4, displayName: 'dee', score: 421, isOwn: false },
  { rank: 5, displayName: 'eff', score: 411, isOwn: false },
  { rank: 6, displayName: 'gee', score: 401, isOwn: false },
  { rank: 7, displayName: 'me', score: 390, isOwn: true },
  { rank: 8, displayName: 'aych', score: 341, isOwn: false },
];

// Own score 390 (rank 7 of 8). 8 fixed bands of 50 anchored at the
// 250 minimum — the server always returns exactly 8, zero-count bands
// included.
vi.mock('../sync/useDailyRank', () => ({
  useDailyRank: () => ({
    data: { rank: 7, total: 8, score: 390, topPercent: 88 },
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useArchiveRank: () => ({
    data: { rank: 7, total: 8, score: 390, topPercent: 88 },
  }),
  useDailyStats: () => ({
    data: { median: 415, total: 8, winRatePct: 25, topScores },
  }),
  useDailyHistogram: () => ({
    data: {
      bins: [
        { lo: 250, hi: 299, count: 1 },
        { lo: 300, hi: 349, count: 1 },
        { lo: 350, hi: 399, count: 1 },
        { lo: 400, hi: 449, count: 4 },
        { lo: 450, hi: 499, count: 0 },
        { lo: 500, hi: 549, count: 0 },
        { lo: 550, hi: 599, count: 1 },
        { lo: 600, hi: 649, count: 0 },
      ],
      median: 415,
      min: 250,
      max: 550,
      total: 8,
    },
  }),
}));

const openSheet = () => {
  render(
    <ToastProvider>
      <RankPanel dateISO="2026-07-02" />
    </ToastProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: /Leaderboard/ }));
};

beforeEach(() => {
  localStorage.clear();
});

describe('daily score distribution (adaptive 8 bands)', () => {
  it('renders all 8 bands including empty ones, labeled every other band', () => {
    openSheet();

    // 8 bands → every other band start is labeled.
    for (const label of ['250', '350', '450', '550']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    const slots = document.querySelectorAll('[class*=histoSlot]');
    expect(slots).toHaveLength(8);
    // Empty bands render a slot with NO bar.
    expect(slots[4].querySelector('[class*=histoBar]')).toBeNull();
    expect(slots[3].querySelector('[class*=histoBar]')).not.toBeNull();

    // Heights are proportional to count (max count 4 → 100%).
    const tall = slots[3].querySelector('[class*=histoBar]') as HTMLElement;
    const quarter = slots[0].querySelector('[class*=histoBar]') as HTMLElement;
    expect(tall.style.height).toBe('100%');
    expect(quarter.style.height).toBe('25%');

    // The player's score (390) highlights its band; the field mutes.
    const ownBar = slots[2].querySelector('[class*=histoBar]') as HTMLElement;
    expect(ownBar.className).toContain('histoBarOwn');
    expect(tall.className).toContain('histoBarMuted');
    expect(slots[2].getAttribute('title')).toContain('· you');
  });
});

describe('top scores (top 5 + own row)', () => {
  it('shows the top 5 plus the own row after a rank-jump divider', () => {
    openSheet();

    // Exactly the top 5 leaders…
    for (const name of ['ace', 'bee', 'cee', 'dee', 'eff']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    // …not the non-own rank 6/8 rows…
    expect(screen.queryByText('gee')).not.toBeInTheDocument();
    expect(screen.queryByText('aych')).not.toBeInTheDocument();
    // …plus the player's own row (#7, from the fetched list; the
    // rank bar behind the sheet also says #7, hence getAllByText).
    const ownName = screen.getByText('me');
    expect(ownName.closest('[class*=topRow]')).not.toBeNull();
    expect(screen.getAllByText('#7').length).toBeGreaterThanOrEqual(2);
    // Rank jumps 5 → 7, so the divider shows.
    expect(screen.getByText('⋯')).toBeInTheDocument();
  });
});

describe('screen-name editor', () => {
  it('offers the editor while no name is saved', () => {
    openSheet();
    expect(screen.getByLabelText('Screen name')).toBeInTheDocument();
  });

  it('retires the editor once a name is stored', () => {
    localStorage.setItem(KEY_HANDLE, 'gridshark');
    openSheet();
    expect(screen.queryByLabelText('Screen name')).not.toBeInTheDocument();
  });
});
