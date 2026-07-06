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
  // Action steps get the compact strip: one header line, then the
  // instruction with its title inlined — no separate title line, no
  // footer (there's no Next button to house). GameScreen pairs this
  // with a shorter coach slot, so the board gets the difference on
  // exactly the steps where the player works the board.
  if (step.kind === 'action') {
    return (
      <section
        className={`${styles.coach} ${styles.coachCompact}`}
        aria-label="Tutorial coach"
      >
        <div className={styles.kickerRow}>
          <span className={styles.kicker}>
            Tutorial · {index + 1}/{count}
          </span>
          <span className={styles.yourMove}>→ your move</span>
          <button type="button" className={styles.skip} onClick={onSkip}>
            Skip tutorial
          </button>
        </div>
        <p key={step.id} className={styles.body}>
          <strong className={styles.inlineTitle}>{step.title}.</strong>{' '}
          {step.body}
        </p>
      </section>
    );
  }

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
        {onNext && (
          <Button size="sm" variant="primary" onClick={onNext}>
            {step.kind === 'free' ? 'Got it' : 'Next'}
          </Button>
        )}
      </div>
    </section>
  );
}
