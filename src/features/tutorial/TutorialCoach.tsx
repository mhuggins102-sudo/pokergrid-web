import { useEffect, useRef } from 'react';
import { Button } from '../../design/primitives';
import { useGameSession } from '../game/GameSessionProvider';
import { TutorialStep } from './tutorialSteps';
import styles from './TutorialCoach.module.css';

export interface TutorialCoachProps {
  step: TutorialStep;
  index: number;
  count: number;
  /** info → advance; free → dismiss the coach. Absent on action steps. */
  onNext?: () => void;
  onSkip: () => void;
}

/**
 * The guide card rendered into GameScreen's coach slot. Collapses to
 * its title line while the ♣ draw panel has the dock (GameScreen flags
 * that phase by sizing the slot down; the slim class drops the body so
 * nothing clips mid-sentence).
 */
export function TutorialCoach({
  step,
  index,
  count,
  onNext,
  onSkip,
}: TutorialCoachProps) {
  const { state } = useGameSession();
  const slim =
    state.phase.kind === 'bonus-card-resolving' ||
    state.phase.kind === 'bonus-card-replacing';

  // The coach slot scrolls when copy outgrows it; a click on Next can
  // leave that scroll mid-card, clipping the next step's first line.
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.parentElement?.scrollTo?.(0, 0);
  }, [step.id]);

  return (
    <section
      ref={ref}
      className={`${styles.coach}${slim ? ` ${styles.slim}` : ''}`}
      aria-label="Tutorial coach"
    >
      <div className={styles.kickerRow}>
        <span className={styles.kicker}>
          Tutorial · {index + 1}/{count}
        </span>
        <button type="button" className={styles.skip} onClick={onSkip}>
          Skip tutorial
        </button>
      </div>
      <h2 className={styles.title}>{step.title}</h2>
      <p className={styles.body}>{step.body}</p>
      <div className={styles.footer}>
        {step.kind === 'action' && (
          <span className={styles.yourMove}>→ your move</span>
        )}
        {onNext && (
          <Button size="sm" variant="primary" onClick={onNext}>
            {step.kind === 'free' ? 'Got it' : 'Next'}
          </Button>
        )}
      </div>
    </section>
  );
}
