import { Sheet } from '../../../design/primitives';
import {
  HAND_BASE_VALUE,
  INCOMPLETE_LINE_PENALTY,
} from '../../../game/scoring';
import { HandRank } from '../../../game/hands';
import { HAND_LABEL } from '../handLabels';
import railStyles from './DesktopRails.module.css';

const ORDER: HandRank[] = [
  'FIVE_OF_A_KIND',
  'ROYAL_FLUSH',
  'STRAIGHT_FLUSH',
  'FOUR_OF_A_KIND',
  'FULL_HOUSE',
  'FLUSH',
  'STRAIGHT',
  'THREE_OF_A_KIND',
  'TWO_PAIR',
  'PAIR',
  'HIGH_CARD',
];

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '4px 0',
  borderBottom: '1px solid var(--hairline)',
  fontSize: 14,
  fontVariantNumeric: 'tabular-nums',
};

/** The hand → base value list (with any Bull Market boosts folded in
 *  and flagged) — shared by the ⓘ sheet and the desktop rail panel. */
export function HandValuesList({
  handBoost,
}: {
  handBoost?: Partial<Record<HandRank, number>>;
}) {
  return (
    <div>
      {ORDER.map(hand => {
        const boost = handBoost?.[hand] ?? 0;
        return (
          <div key={hand} style={rowStyle}>
            <span>{HAND_LABEL[hand]}</span>
            <strong>
              {HAND_BASE_VALUE[hand] + boost}
              {boost > 0 && (
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                  {' '}
                  (+{boost})
                </span>
              )}
            </strong>
          </div>
        );
      })}
      <div style={{ ...rowStyle, borderBottom: 'none', color: 'var(--danger)' }}>
        <span>Unfinished line at game end</span>
        <strong>{INCOMPLETE_LINE_PENALTY}</strong>
      </div>
    </div>
  );
}

export function HandValuesDialog({
  open,
  onClose,
  // Bull Market: per-hand base-value boosts to fold in and flag.
  handBoost,
}: {
  open: boolean;
  onClose: () => void;
  handBoost?: Partial<Record<HandRank, number>>;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Hand values">
      <HandValuesList handBoost={handBoost} />
    </Sheet>
  );
}

/**
 * Bull Market's desktop right-rail panel: the run has no bonus cards
 * (♣ invests into hand values instead), so the bonus panel's position
 * shows the live hand-value table — the numbers the twist is mutating
 * — in the same panel chrome.
 */
export function DeskHandValuesPanel({
  handBoost,
}: {
  handBoost?: Partial<Record<HandRank, number>>;
}) {
  return (
    <section className={railStyles.panel} aria-label="Hand values">
      <header className={railStyles.head}>
        <h2 className={railStyles.title}>Hand Values</h2>
        <span className={railStyles.headNote}>♣ invests</span>
      </header>
      <div style={{ marginTop: 8 }}>
        <HandValuesList handBoost={handBoost} />
      </div>
    </section>
  );
}
