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
 * The guide strip rendered into GameScreen's coach slot — compact on
 * EVERY step so the board keeps as much height as possible: one
 * header line (step counter, the step's control — "→ your move" or
 * the Next/Got it button — and Skip), then the instruction with its
 * title inlined. The slot has a fixed height so steps never resize
 * the layout; the body scrolls internally if copy ever runs long
 * (keyed by step so the scroll resets). While the ♣ draw panel has
 * the dock, GameScreen unmounts the coach entirely.
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
        {step.kind === 'action' && (
          <span className={styles.yourMove}>→ your move</span>
        )}
        <span className={styles.headSpacer} />
        <button type="button" className={styles.skip} onClick={onSkip}>
          Skip tutorial
        </button>
        {onNext && (
          <Button size="sm" variant="primary" onClick={onNext}>
            {step.kind === 'free' ? 'Got it' : 'Next'}
          </Button>
        )}
      </div>
      <p key={step.id} className={styles.body}>
        <strong className={styles.inlineTitle}>{step.title}.</strong>{' '}
        {step.body}
      </p>
    </section>
  );
}
