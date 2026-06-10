import { Sheet } from '../../../design/primitives';
import { useGameSession } from '../GameSessionProvider';
import { CardFace, cardAriaLabel } from './CardFace';

const listStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))',
  gap: 8,
};

const cellStyle: React.CSSProperties = {
  aspectRatio: '1 / 1',
  position: 'relative',
  padding: 0,
};

/**
 * Revive (Three Tricks special): pick a card from the discard pile to
 * bring back onto the next spiral slot.
 */
export function ReviveSheet({ open }: { open: boolean }) {
  const { state, dispatch } = useGameSession();
  return (
    <Sheet
      open={open}
      onClose={() => dispatch({ type: 'CANCEL_ACTION' })}
      title="Revive — pick a discard"
    >
      <div style={listStyle}>
        {state.discards.map((card, i) => (
          <button
            key={i}
            type="button"
            style={cellStyle}
            aria-label={`Revive ${cardAriaLabel(card)}`}
            onClick={() => dispatch({ type: 'RESOLVE_REVIVE', discardIdx: i })}
          >
            <CardFace card={card} />
          </button>
        ))}
      </div>
    </Sheet>
  );
}
