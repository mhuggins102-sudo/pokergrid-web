import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useToast } from '../../design/primitives';
import { Action } from '../../game/state';
import {
  ActionGate,
  GameSessionGate,
  GameSessionProvider,
} from '../game/GameSessionProvider';
import { GameScreen } from '../game/GameScreen';
import { CoachHighlightContext } from '../game/coach';
import { TutorialCoach } from './TutorialCoach';
import { TUTORIAL_STEPS } from './tutorialSteps';
import { markTutorialSeen } from './tutorialSeen';

/**
 * /tutorial — the guided first game. The real GameScreen runs a
 * handcrafted deal while an action gate constrains play to the
 * coach's scripted move; after the guided steps the gate opens and
 * the player finishes the deal (and meets the real result screen)
 * on their own.
 */
export function TutorialPage() {
  const [runId, setRunId] = useState(0);
  return (
    <GameSessionProvider key={runId} mode={{ kind: 'tutorial' }}>
      <TutorialRun key={runId} onReplay={() => setRunId(n => n + 1)} />
    </GameSessionProvider>
  );
}

function TutorialRun({ onReplay }: { onReplay: () => void }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stepIndex, setStepIndex] = useState(0);
  const [coachDismissed, setCoachDismissed] = useState(false);
  const step = TUTORIAL_STEPS[stepIndex];

  const advance = useCallback(
    () => setStepIndex(i => Math.min(i + 1, TUTORIAL_STEPS.length - 1)),
    []
  );

  // Reaching the free-play tail counts as "took the tutorial".
  useEffect(() => {
    if (step.kind === 'free') markTutorialSeen();
  }, [step]);

  // Nudge on blocked taps, throttled so mashing doesn't stack toasts.
  const lastNudge = useRef(0);
  const nudge = useCallback(
    (message: string) => {
      const now = Date.now();
      if (now - lastNudge.current < 2500) return;
      lastNudge.current = now;
      toast(message);
    },
    [toast]
  );

  const gate = useMemo<ActionGate>(
    () => ({
      allow: (a: Action) =>
        step.kind === 'free' ||
        (step.kind === 'action' &&
          (a.type === 'CANCEL_ACTION' || step.allows!(a))),
      onAction: (a: Action) => {
        if (step.kind === 'action' && step.completes!(a)) advance();
      },
      onBlocked: () =>
        nudge(
          step.kind === 'action'
            ? 'Try the highlighted move — see the coach card.'
            : 'Read the coach card, then hit Next.'
        ),
    }),
    [step, advance, nudge]
  );

  const skip = useCallback(() => {
    markTutorialSeen();
    navigate('/');
  }, [navigate]);

  const highlight = step.kind === 'action' ? (step.highlight ?? null) : null;

  const coach = coachDismissed ? null : (
    <TutorialCoach
      step={step}
      index={stepIndex}
      count={TUTORIAL_STEPS.length}
      onNext={
        step.kind === 'info'
          ? advance
          : step.kind === 'free'
            ? () => setCoachDismissed(true)
            : undefined
      }
      onSkip={skip}
    />
  );

  return (
    <GameSessionGate gate={gate}>
      <CoachHighlightContext.Provider value={highlight}>
        <GameScreen onReplay={onReplay} coach={coach} />
      </CoachHighlightContext.Provider>
    </GameSessionGate>
  );
}
