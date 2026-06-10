import { useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router';
import { CHALLENGES, ChallengeId } from '../../game/challenges';
import { GameSessionProvider } from '../game/GameSessionProvider';
import { GameScreen } from '../game/GameScreen';

const isChallengeId = (v: string | undefined): v is ChallengeId =>
  CHALLENGES.some(c => c.id === v);

/** /challenges/:id — run one challenge (Hard ruleset, no undos). */
export function ChallengePlayPage() {
  const { id } = useParams<'id'>();
  const [params] = useSearchParams();
  const seedParam = params.get('seed');
  const [runId, setRunId] = useState(0);

  if (!isChallengeId(id)) return <Navigate to="/challenges" replace />;

  const seed =
    seedParam !== null && /^\d+$/.test(seedParam)
      ? Number(seedParam) + runId
      : undefined;

  return (
    <GameSessionProvider
      key={`${id}-${runId}`}
      mode={{ kind: 'challenge', id }}
      seed={seed}
    >
      <GameScreen onReplay={() => setRunId(n => n + 1)} />
    </GameSessionProvider>
  );
}
