import { Card, Rank, Suit } from '../../game/cards';
import { CardFace } from '../game/components/CardFace';
import { useGameFamily } from '../game/useGameFamily';
import { useSettingsStore } from './settingsStore';
import { useResolvedTheme } from './useTheme';
import { DockLayoutPreview } from './DockLayoutPreview';
import styles from './DisplayPreview.module.css';

const c = (rank: Rank, suit: Suit): Card => ({ kind: 'standard', rank, suit });

// A mostly-full 5×5 board: all four suits present (so two- vs
// four-color reads instantly), a made top row, a few open cells.
const SAMPLE: (Card | null)[] = [
  c('A', 'S'),
  c('K', 'H'),
  c('Q', 'D'),
  c('J', 'C'),
  c('10', 'S'),
  c('9', 'H'),
  c('9', 'D'),
  null,
  c('4', 'C'),
  c('2', 'S'),
  c('7', 'H'),
  null,
  c('7', 'D'),
  c('7', 'C'),
  c('3', 'S'),
  c('5', 'D'),
  c('5', 'S'),
  c('8', 'C'),
  null,
  c('K', 'D'),
  c('A', 'H'),
  c('6', 'C'),
  c('J', 'D'),
  c('Q', 'S'),
  null,
];
const ROW_TOTALS = [30, 2, 0, 5, 0];
const COL_TOTALS = [4, 0, 8, 21, 2];

/**
 * The Settings "Display" section's live sample: a mini board (with
 * rail chips, felt panel, and deck coloring all following the current
 * settings) plus the picked dock arrangement — wrapped in its own
 * data-theme scope so it re-themes with the Theme/Appearance choices
 * without waiting on the page. Purely illustrative: inert and hidden
 * from the accessibility tree.
 */
export function DisplayPreview() {
  const resolved = useResolvedTheme();
  // The preview mirrors the game THIS viewport would launch: the desk
  // families (desktop, tablet-landscape) put the dock in a right rail
  // beside the board; the column family (phone, tablet-portrait) pins
  // it below.
  const desk = useGameFamily() !== 'column';
  // Mirror the Settings page's "Line totals" row: it binds the
  // family's key (column → lineRails, desk → deskLineChips), so the
  // preview must follow the SAME key or the toggle looks inert here.
  const lineRails = useSettingsStore(s =>
    desk ? s.deskLineChips : s.lineRails
  );
  const dockLayout = useSettingsStore(s => s.dockLayout);

  const chip = (total: number, key: string) => (
    <span
      key={key}
      className={`${styles.chip} ${total > 0 ? styles.chipPos : styles.chipZero}`}
    >
      <span className={styles.chipVal}>{total}</span>
    </span>
  );

  return (
    <div
      data-theme={resolved}
      className={`${styles.preview} ${desk ? styles.previewDesk : ''}`}
      aria-hidden="true"
    >
      {/* Rails mirror the game: row totals down the RIGHT edge, column
          totals underneath (LineRails .railsRight / the desk edge
          chips). The column family additionally thins the row chips
          and rotates their digits, exactly like the phone game. */}
      <div
        className={`${styles.boardWrap} ${lineRails ? styles.withRails : ''} ${
          desk ? '' : styles.colFamily
        }`}
      >
        <div className={styles.board}>
          <div className={styles.grid}>
            {SAMPLE.map((card, i) => (
              <div
                key={i}
                className={`${styles.cell} ${card ? styles.cellFilled : ''}`}
              >
                {card && <CardFace card={card} />}
              </div>
            ))}
          </div>
        </div>
        {lineRails && (
          <div className={styles.rowRail}>
            {ROW_TOTALS.map((t, i) => chip(t, `r${i}`))}
          </div>
        )}
        {lineRails && (
          <div className={styles.colRail}>
            {COL_TOTALS.map((t, i) => chip(t, `c${i}`))}
          </div>
        )}
      </div>
      <div className={desk ? styles.dockSide : styles.dockPreview}>
        {/* Desk families preview the desk dock the game actually shows
            (center-stage vs compact, in the right rail); the column
            family previews the dock the picker's four options describe,
            pinned below the board. */}
        <DockLayoutPreview layout={dockLayout} desk={desk} />
      </div>
    </div>
  );
}
