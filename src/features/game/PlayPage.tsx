import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Difficulty } from '../../game/rules';
import { GameSessionProvider } from './GameSessionProvider';
import { GameScreen } from './GameScreen';
import { DifficultyPicker } from './DifficultyPicker';

const isDifficulty = (v: string | null): v is Difficulty =>
  v === 'easy' || v === 'medium' || v === 'hard' || v === 'extreme';

/**
 * /play — free play. Without a valid ?difficulty=, shows the picker.
 * With one, runs a game; an optional ?seed= makes the whole run
 * deterministic (used by E2E tests; harmless to share).
 */
export function PlayPage() {
  const [params] = useSearchParams();
  const difficultyParam = params.get('difficulty');
  const seedParam = params.get('seed');
  // Bumping runId remounts the provider → fresh shuffle, same settings.
  const [runId, setRunId] = useState(0);

  if (!isDifficulty(difficultyParam)) {
    return <DifficultyPicker />;
  }

  const seed =
    seedParam !== null && /^\d+$/.test(seedParam)
      ? // Successive runs from the same seed stay deterministic but differ.
        Number(seedParam) + runId
      : undefined;

  return (
    <GameSessionProvider
      key={`${difficultyParam}-${seedParam ?? 'random'}-${runId}`}
      difficulty={difficultyParam}
      seed={seed}
    >
      <GameScreen onReplay={() => setRunId(n => n + 1)} />
    </GameSessionProvider>
  );
}
