import { render, screen, waitFor } from '@testing-library/react';
import { runBotGame } from '../../../game/bot';
import type { ScoreReport } from '../../../game/scoring';
import type { GameState } from '../../../game/state';
import { useStatsStore } from '../../progress/statsStore';
import { BotScoreSheet } from '../components/BotScoreSheet';

// The Bot Score sheet judges the bot-comparison achievements once the
// bot's score arrives (the run itself was recorded earlier). jsdom has
// no Worker, so the sheet computes the bot's run on the main thread —
// the same deterministic game runBotGame replays here.
describe('Bot Buster from the Bot Score sheet', () => {
  const seed = 1234;
  const botScore = runBotGame('hard', seed).report.total;
  const stateOf = (difficulty: GameState['difficulty']) =>
    ({ difficulty }) as unknown as GameState;
  const reportOf = (total: number) => ({ total }) as unknown as ScoreReport;

  beforeEach(() => useStatsStore.getState().reset());

  it('awards and persists it when the player wins by 200+ on Hard', async () => {
    const playerScore = botScore + 200;
    render(
      <BotScoreSheet
        open
        onClose={() => {}}
        difficulty="hard"
        seed={seed}
        playerScore={playerScore}
        state={stateOf('hard')}
        report={reportOf(playerScore)}
      />
    );
    await waitFor(
      () => expect(screen.getByTestId('bot-final-score')).toHaveTextContent(String(botScore)),
      { timeout: 20_000 }
    );
    await waitFor(() =>
      expect(screen.getByTestId('bot-achievement')).toHaveTextContent('Bot Buster')
    );
    expect(useStatsStore.getState().stats.achievementsDone).toContain('beat-the-bot');
  }, 30_000);

  it('stays quiet one point short of the margin', async () => {
    const playerScore = botScore + 199;
    render(
      <BotScoreSheet
        open
        onClose={() => {}}
        difficulty="hard"
        seed={seed}
        playerScore={playerScore}
        state={stateOf('hard')}
        report={reportOf(playerScore)}
      />
    );
    await waitFor(
      () => expect(screen.getByTestId('bot-final-score')).toHaveTextContent(String(botScore)),
      { timeout: 20_000 }
    );
    expect(screen.queryByTestId('bot-achievement')).toBeNull();
    expect(useStatsStore.getState().stats.achievementsDone).not.toContain('beat-the-bot');
  }, 30_000);
});
