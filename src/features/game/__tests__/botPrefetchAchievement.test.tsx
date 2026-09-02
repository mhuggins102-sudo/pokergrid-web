import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ToastProvider } from '../../../design/primitives';
import { seededRng } from '../../../game/deck';
import { scoreGrid } from '../../../game/scoring';
import { newGame, step } from '../../../game/state';
import { useStatsStore } from '../../progress/statsStore';
import { PlayPage } from '../PlayPage';
import { primeBotRun } from '../botRun';

// The result screen judges Bot Buster against the bot run the session
// started when the game began. jsdom has no Worker (the prefetch is a
// no-op there), so the test installs the finished run the way the
// prefetch would have — scored 200 under what a Place-only game on
// this seed ends on.
const seed = 1234;
const placeOnlyScore = (): number => {
  let s = newGame('hard', seededRng(seed));
  while (s.phase.kind !== 'game-over') s = step(s, { type: 'PLACE' });
  return scoreGrid(s.grid, s.bonusCards, {
    deckRemaining: s.deck.length,
    discards: s.discards,
    perkSpent: s.perkSpent,
  }).total;
};

const playToEnd = () => {
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[`/play?difficulty=hard&seed=${seed}`]}>
        <Routes>
          <Route path="/play" element={<PlayPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );
  for (let i = 0; i < 60; i++) {
    const place = screen.queryByRole('button', { name: 'Place' });
    if (!place) break;
    fireEvent.click(place);
  }
  expect(screen.getByTestId('final-score')).toBeInTheDocument();
};

describe('Bot Buster on the result screen', () => {
  beforeEach(() => useStatsStore.getState().reset());

  it('announces it with the run when the prefetched bot run lost by 200+', async () => {
    const player = placeOnlyScore();
    primeBotRun(
      'hard',
      seed,
      Promise.resolve({ score: player - 200, target: 500, won: false, actions: [] })
    );
    playToEnd();
    // The result callout names the achievement (the row reads "Bot
    // Buster · Achievement unlocked").
    expect(
      await screen.findByRole('button', { name: /Bot Buster/ })
    ).toBeInTheDocument();
    expect(useStatsStore.getState().stats.achievementsDone).toContain('beat-the-bot');
  });

  it('stays quiet when the bot finished within 200', async () => {
    const player = placeOnlyScore();
    primeBotRun(
      'hard',
      seed,
      Promise.resolve({ score: player - 199, target: 500, won: false, actions: [] })
    );
    playToEnd();
    // Let the (already settled) bot promise flush.
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.queryByRole('button', { name: /Bot Buster/ })).toBeNull();
    expect(useStatsStore.getState().stats.achievementsDone).not.toContain('beat-the-bot');
  });
});
