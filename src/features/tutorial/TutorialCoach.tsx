import { Button } from '../../design/primitives';
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
 * The guide card rendered into GameScreen's coach slot. The slot has a
 * fixed height so steps never resize the layout; the body is the only
 * part that varies, scrolling internally when copy runs long (keyed by
 * step so the scroll resets each step). While the ♣ draw panel has the
 * dock, GameScreen unmounts the coach entirely.
 */
export function TutorialCoach({
  step,
  index,
  count,
  onNext,
  onSkip,
}: TutorialCoachProps) {
  return (
    <section className={styles.coach} aria-label="Tutorial coach">
      <div className={styles.kickerRow}>
        <span className={styles.kicker}>
          Tutorial · {index + 1}/{count}
        </span>
        <button type="button" className={styles.skip} onClick={onSkip}>
          Skip tutorial
        </button>
      </div>
      <h2 className={styles.title}>{step.title}</h2>
      <p key={step.id} className={styles.body}>
        {step.body}
      </p>
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
