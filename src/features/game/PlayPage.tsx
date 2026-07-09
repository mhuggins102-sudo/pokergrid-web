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
 * With one, runs a game; an optional ?seed= pins the exact deal (share
 * links and E2E tests use this). Without ?seed= a random one is minted
 * — every free run is seeded, so a finished game can hand its deal to
 * a friend via the share link ("beat my score on this exact deal").
 */
export function PlayPage() {
  const [params] = useSearchParams();
  const difficultyParam = params.get('difficulty');
  const seedParam = params.get('seed');
  // Bumping runId remounts the provider → fresh shuffle, same settings.
  const [runId, setRunId] = useState(0);
  // Minted once per visit; "Play again" varies the run via +runId, the
  // same trick the explicit-seed path uses.
  const [mintedSeed] = useState(() => Math.floor(Math.random() * 0x7fffffff));

  if (!isDifficulty(difficultyParam)) {
    return <DifficultyPicker />;
  }

  const seed =
    (seedParam !== null && /^\d+$/.test(seedParam)
      ? Number(seedParam)
      : mintedSeed) + runId;

  return (
    <GameSessionProvider
      key={`${difficultyParam}-${seedParam ?? 'random'}-${runId}`}
      mode={{ kind: 'free', difficulty: difficultyParam }}
      seed={seed}
    >
      <GameScreen onReplay={() => setRunId(n => n + 1)} />
    </GameSessionProvider>
  );
}
