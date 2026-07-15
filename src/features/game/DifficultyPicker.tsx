import { CSSProperties, useState } from 'react';
import { Link } from 'react-router';
import {
  BONUS_SWAP_AT_CAP_BY_DIFFICULTY,
  BONUS_SWAP_LABEL,
  CAN_PREVIEW_DECK_BY_DIFFICULTY,
  Difficulty,
  JOKERS_BY_DIFFICULTY,
  NO_DISCARDS_BY_DIFFICULTY,
  STARTER_BONUS_BY_DIFFICULTY,
  TARGET_BY_DIFFICULTY,
  UNDOS_BY_DIFFICULTY,
  difficultySentence,
} from '../../game/rules';
import { difficultyColors } from '../../design/tokens';
import { useTier } from '../../app/useTier';
import styles from './DifficultyPicker.module.css';

/*
 * The Free Play entry at every tier (phase 3 convergence), per
 * design-refs/desktop/Free Play.dc.html: four difficulty cards
 * (select-on-click, Medium preselected), each carrying the target, a
 * blurb, and the five rule axes from the real rules tables; below,
 * the Starting bar with the seeded-run toggle and the Start button.
 *
 * Phone (density pass): the header text block and the four stacked
 * cards are replaced by a 4-button difficulty selector row (segmented
 * pills, Medium preselected) over ONE difficulty card that re-renders
 * per selection, then the same Starting bar. ≥768 is unchanged.
 */

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'extreme'];

const NAME: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  extreme: 'Extreme',
};

// One-paragraph card blurb — the shared difficulty sentence, with the undo
// clause reflecting Free Play's real rule (Hard / Extreme run with no undo,
// unlike the daily's one-undo-for-all).
const blurb = (d: Difficulty): string => {
  const undos = UNDOS_BY_DIFFICULTY[d];
  const undoClause =
    undos === 0 ? 'no undo' : undos === 1 ? 'one undo' : `${undos} undos`;
  return difficultySentence(d, undoClause);
};

interface Axis {
  label: string;
  value: string;
  // "Good" axes (the help you DO get) read in full ink; stripped ones
  // fade to ink-3 — the mockup's affordance for scanning a column.
  good: boolean;
}

// Same canonical order as the sentence + the in-game popup: jokers,
// starter bonus, bonus swap, deck peek, discards, undo.
const axesFor = (d: Difficulty): Axis[] => {
  const jokers = JOKERS_BY_DIFFICULTY[d];
  const starter = STARTER_BONUS_BY_DIFFICULTY[d];
  const swap = BONUS_SWAP_AT_CAP_BY_DIFFICULTY[d];
  const undos = UNDOS_BY_DIFFICULTY[d];
  const peek = CAN_PREVIEW_DECK_BY_DIFFICULTY[d];
  const discards = !NO_DISCARDS_BY_DIFFICULTY[d];
  // Value formats kept identical to the in-game difficulty popup
  // (GameScreen.navPill): numerical jokers/starter, Must/Available/Off
  // swap, On/Off peek + discards, "N per game" undos.
  return [
    { label: 'Jokers in deck', value: String(jokers), good: jokers > 0 },
    { label: 'Starter bonus', value: String(starter), good: starter > 0 },
    { label: 'Bonus swap', value: BONUS_SWAP_LABEL[swap], good: swap !== 'off' },
    { label: 'Deck peek', value: peek ? 'On' : 'Off', good: peek },
    { label: 'Discards', value: discards ? 'On' : 'Off', good: discards },
    {
      label: 'Undos',
      value: undos > 0 ? `${undos} per game` : '—',
      good: undos > 0,
    },
  ];
};

export function DifficultyPicker() {
  const [sel, setSel] = useState<Difficulty>('medium');
  const [seeded, setSeeded] = useState(false);
  // Minted once per visit. Free runs are internally seeded either way
  // (PlayPage mints one when the URL has none); the toggle's job is to
  // PIN the deal in the address bar so it can be copied/shared before
  // the run even starts.
  const [seed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const isPhone = useTier() === 'phone';

  const startTo = `/play?difficulty=${sel}${seeded ? `&seed=${seed}` : ''}`;

  // The full difficulty card — reused as the four-up grid ≥768 and as
  // the single re-rendering card at phone.
  const renderCard = (d: Difficulty) => {
    const selected = d === sel;
    return (
      <button
        key={d}
        type="button"
        aria-pressed={selected}
        className={`${styles.card} ${selected ? styles.cardSel : ''}`}
        style={{ '--tone': difficultyColors[d] } as CSSProperties}
        onClick={() => setSel(d)}
      >
        <span className={styles.cardTop}>
          <span className={styles.cardName}>{NAME[d]}</span>
          <span className={styles.cardDot} aria-hidden="true" />
        </span>
        <span className={styles.cardTarget}>
          <span className={styles.targetNum}>{TARGET_BY_DIFFICULTY[d]}</span>
          <span className={styles.targetLabel}>target</span>
        </span>
        <span className={styles.blurb}>{blurb(d)}</span>
        <span className={styles.axes}>
          {axesFor(d).map(ax => (
            <span key={ax.label} className={styles.axis}>
              <span className={styles.axisLabel}>{ax.label}</span>
              <span
                className={`${styles.axisVal} ${ax.good ? styles.axisValGood : ''}`}
              >
                {ax.value}
              </span>
            </span>
          ))}
        </span>
      </button>
    );
  };

  // The seeded-run toggle + Start button — shared by the desktop
  // Starting bar and the phone in-card controls.
  const seedToggle = (
    <button
      type="button"
      role="switch"
      aria-checked={seeded}
      className={styles.seedToggle}
      onClick={() => setSeeded(s => !s)}
    >
      <span
        className={`${styles.seedTrack} ${seeded ? styles.seedTrackOn : ''}`}
        aria-hidden="true"
      >
        <span
          className={`${styles.seedKnob} ${seeded ? styles.seedKnobOn : ''}`}
        />
      </span>
      Seeded run
    </button>
  );
  const startLink = (
    <Link to={startTo} className={styles.startBtn}>
      Start game <span aria-hidden="true">→</span>
    </Link>
  );

  return (
    <div className={styles.wrap}>
      {isPhone ? (
        <>
          {/* Segmented difficulty selector (Stats-filter styling). */}
          <div className={styles.diffSelect} role="group" aria-label="Difficulty">
            {DIFFICULTIES.map(d => (
              <button
                key={d}
                type="button"
                aria-pressed={d === sel}
                className={`${styles.diffPill} ${d === sel ? styles.diffPillOn : ''}`}
                style={{ '--tone': difficultyColors[d] } as CSSProperties}
                onClick={() => setSel(d)}
              >
                {NAME[d]}
              </button>
            ))}
          </div>
          {/* ONE card: the difficulty details, then the seeded toggle +
              Start button folded in below them (the standalone Starting
              bar is desktop-only). */}
          <div
            className={styles.singleCard}
            style={{ '--tone': difficultyColors[sel] } as CSSProperties}
          >
            {renderCard(sel)}
            <div className={styles.phoneStart}>
              {seedToggle}
              {startLink}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className={styles.head}>
            <div>
              <div className={styles.eyebrow}>Free Play</div>
              <h1 className={styles.title}>Choose your table</h1>
            </div>
            <p className={styles.lede}>
              Same 5×5 puzzle, four levels of help. Pick a difficulty — the
              deck, tools, and target all shift with it. Play as many as you
              like; Free Play doesn&apos;t touch the daily leaderboard.
            </p>
          </div>

          <div className={styles.cards}>{DIFFICULTIES.map(renderCard)}</div>

          <div className={styles.startBar}>
            <div>
              <div className={styles.startingLabel}>Starting</div>
              <div
                className={styles.startingName}
                style={{ '--tone': difficultyColors[sel] } as CSSProperties}
              >
                {NAME[sel]}{' '}
                <span className={styles.startingTarget}>
                  · {TARGET_BY_DIFFICULTY[sel]} to clear
                </span>
              </div>
            </div>
            <div className={styles.startRight}>
              {seedToggle}
              {startLink}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
