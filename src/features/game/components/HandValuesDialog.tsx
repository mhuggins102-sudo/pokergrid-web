import { Sheet } from '../../../design/primitives';
import { HAND_BASE_VALUE, INCOMPLETE_LINE_PENALTY } from '../../../game/scoring';
import { HandRank } from '../../../game/hands';
import { HAND_LABEL } from '../handLabels';

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

export function HandValuesDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Hand values">
      <div>
        {ORDER.map(hand => (
          <div key={hand} style={rowStyle}>
            <span>{HAND_LABEL[hand]}</span>
            <strong>{HAND_BASE_VALUE[hand]}</strong>
          </div>
        ))}
        <div style={{ ...rowStyle, borderBottom: 'none', color: 'var(--danger)' }}>
          <span>Unfinished line at game end</span>
          <strong>{INCOMPLETE_LINE_PENALTY}</strong>
        </div>
      </div>
    </Sheet>
  );
}
