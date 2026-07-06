import { Difficulty } from '../../game/rules';
import { difficultyColors } from '../../design/tokens';
import { DIFFICULTIES, HistoryPoint } from './modeStats';
import styles from './StatsPage.module.css';

// ViewBox space — rendered at 100% width, so these are proportions.
const W = 320;
const H = 150;
const PAD = { top: 8, right: 10, bottom: 20, left: 36 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

// Round the axis bound out to a friendly 50-step.
const niceUp = (v: number) => Math.max(50, Math.ceil(v / 50) * 50);
const niceDown = (v: number) => Math.min(0, Math.floor(v / 50) * 50);

/**
 * A difficulty's dot: color AND shape (circle / square / diamond /
 * triangle). The medium↔hard hues sit close under deuteranopia, so
 * shape carries identity when color can't — and the legend teaches
 * the pairing.
 */
function Dot({
  x,
  y,
  d,
  r,
  title,
}: {
  x: number;
  y: number;
  d: Difficulty;
  r: number;
  title?: string;
}) {
  const c = difficultyColors[d];
  const label = title ? <title>{title}</title> : null;
  switch (d) {
    case 'easy':
      return (
        <circle cx={x} cy={y} r={r} fill={c}>
          {label}
        </circle>
      );
    case 'medium':
      return (
        <rect x={x - r} y={y - r} width={2 * r} height={2 * r} fill={c}>
          {label}
        </rect>
      );
    case 'hard':
      return (
        <rect
          x={x - r}
          y={y - r}
          width={2 * r}
          height={2 * r}
          fill={c}
          transform={`rotate(45 ${x} ${y})`}
        >
          {label}
        </rect>
      );
    case 'extreme':
      return (
        <polygon
          points={`${x},${y - r - 1} ${x - r},${y + r} ${x + r},${y + r}`}
          fill={c}
        >
          {label}
        </polygon>
      );
  }
}

/**
 * Score over plays: every stored run in chronological order, joined by
 * a quiet line, each play a difficulty-toned (and -shaped) dot. Lives
 * behind the Score distribution panel's chart toggle; receives points
 * already scoped by the page filter.
 */
export function ScoreTrend({ points }: { points: HistoryPoint[] }) {
  const scores = points.map(p => p.score);
  const max = niceUp(Math.max(...scores, 1));
  const min = niceDown(Math.min(...scores, 0));
  const span = max - min;

  const xOf = (i: number) =>
    PAD.left +
    (points.length === 1 ? INNER_W / 2 : (i / (points.length - 1)) * INNER_W);
  const yOf = (s: number) => PAD.top + INNER_H - ((s - min) / span) * INNER_H;

  // Dense histories: thin the dots, keep the line.
  const r = points.length > 200 ? 1.8 : points.length > 60 ? 2.4 : 3;

  const gridValues = min < 0 ? [min, 0, max] : [0, max / 2, max];
  const present = DIFFICULTIES.filter(d => points.some(p => p.difficulty === d));

  return (
    <div className={styles.trendWrap}>
      <svg
        className={styles.trendSvg}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Score per play, ${points.length} plays`}
      >
        {gridValues.map(v => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yOf(v)}
              y2={yOf(v)}
              className={styles.trendGrid}
            />
            <text x={PAD.left - 5} y={yOf(v) + 3} className={styles.trendTick}>
              {v}
            </text>
          </g>
        ))}
        <text
          x={W - PAD.right}
          y={H - 6}
          textAnchor="end"
          className={styles.trendTick}
        >
          plays →
        </text>
        {points.length > 1 && (
          <polyline
            className={styles.trendLine}
            points={points.map((p, i) => `${xOf(i)},${yOf(p.score)}`).join(' ')}
          />
        )}
        {points.map((p, i) => (
          <Dot
            key={`${p.ts}-${i}`}
            x={xOf(i)}
            y={yOf(p.score)}
            d={p.difficulty}
            r={r}
            title={`#${i + 1}: ${p.score} · ${p.difficulty} · ${
              p.won ? 'won' : 'lost'
            }`}
          />
        ))}
      </svg>
      {present.length > 1 && (
        <div className={styles.trendLegend} aria-hidden="true">
          {present.map(d => (
            <span key={d} className={styles.trendLegendItem}>
              <svg viewBox="0 0 10 10" width="10" height="10">
                <Dot x={5} y={5} d={d} r={3.4} />
              </svg>
              {d}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
