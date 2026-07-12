import { Button } from '../../design/primitives';
import { useTier } from '../../app/useTier';
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
  // ≥1024px the coach renders as a proper desktop rail panel (below,
  // unchanged phone strip). No mockup covers the tutorial — the panel
  // is composed from the established desktop language: raised-card
  // chrome with an uppercase header + right-hand note (the SCORING /
  // Bonus Cards panels), an accent progress track (the Challenges
  // sweep bar, thinner), and the step copy in the panels' body type.
  // Same aria contract and controls as the phone strip, so the
  // tutorial e2e drives both breakpoints identically.
  const isDesktop = useTier() === 'desktop';
  if (isDesktop) {
    return (
      <section className={styles.deskCoach} aria-label="Tutorial coach">
        <div className={styles.deskHead}>
          <span className={styles.deskTitle}>Tutorial</span>
          <span className={styles.deskCount}>
            Step {index + 1} of {count}
          </span>
        </div>
        <div
          className={styles.deskTrack}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={count}
          aria-valuenow={index + 1}
          aria-label="Tutorial progress"
        >
          <div
            className={styles.deskFill}
            style={{ width: `${((index + 1) / count) * 100}%` }}
          />
        </div>
        {/* Keyed by step so an internal scroll never carries over. */}
        <p key={step.id} className={styles.deskBody}>
          <strong className={styles.deskStepTitle}>{step.title}.</strong>{' '}
          {step.body}
        </p>
        <div className={styles.deskFoot}>
          {step.kind === 'action' && (
            <span className={styles.deskYourMove}>→ your move</span>
          )}
          <span className={styles.deskFootSpacer} />
          <button
            type="button"
            className={styles.deskSkip}
            onClick={onSkip}
          >
            Skip tutorial
          </button>
          {onNext && (
            <Button size="sm" variant="primary" onClick={onNext}>
              {step.kind === 'free' ? 'Got it' : 'Next'}
            </Button>
          )}
        </div>
      </section>
    );
  }

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
