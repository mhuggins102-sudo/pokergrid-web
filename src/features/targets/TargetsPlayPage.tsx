import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { hydrateSavedCards } from '../../lib/targetsUpSave';
import { GameSessionProvider } from '../game/GameSessionProvider';
import { GameScreen } from '../game/GameScreen';
import { useTargetsStore } from './targetsStore';

/**
 * /targets/play — the current Targets-Up level. The save is snapshotted
 * once per run (the result flow rewrites or clears it mid-display, and
 * the active game must not react); "Next level" remounts the run, which
 * re-reads the advanced save.
 */
export function TargetsPlayPage() {
  const [params] = useSearchParams();
  const seedParam = params.get('seed');
  const [runId, setRunId] = useState(0);

  const seed =
    seedParam !== null && /^\d+$/.test(seedParam)
      ? Number(seedParam) + runId
      : undefined;

  return (
    <TargetsRun key={runId} seed={seed} onReplay={() => setRunId(n => n + 1)} />
  );
}

function TargetsRun({
  seed,
  onReplay,
}: {
  seed: number | undefined;
  onReplay: () => void;
}) {
  // Frozen at mount — store updates from the result flow must not
  // restart the run underneath the player.
  const [snapshot] = useState(() => {
    const save = useTargetsStore.getState().save;
    return { level: save?.level ?? 1, ...hydrateSavedCards(save) };
  });

  return (
    <GameSessionProvider
      mode={{
        kind: 'targets',
        level: snapshot.level,
        deckExtras: snapshot.deckExtras,
        superchargedDeckCards: snapshot.superchargedDeckCards,
      }}
      seed={seed}
    >
      <GameScreen onReplay={onReplay} />
    </GameSessionProvider>
  );
}
