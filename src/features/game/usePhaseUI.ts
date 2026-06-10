import { useEffect, useMemo, useState } from 'react';
import { suitActionAvailable } from '../../game/actions';
import { Suit, isJoker } from '../../game/cards';
import { nextSpiralSlot } from '../../game/grid';
import { BonusCard } from '../../game/bonusCards';
import { useGameSession } from './GameSessionProvider';

export type CellRole = 'next' | 'target' | 'selected' | null;

export interface PhaseAction {
  id: string;
  label: string;
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  onPress: () => void;
}

export interface BonusDialogUI {
  mode: 'resolving' | 'replacing';
  drawn: BonusCard[];
  /** replacing only: index into drawn of the card being brought in. */
  pickedNew?: number;
  atCap: boolean;
  canDecline: boolean;
}

export interface PhaseUI {
  phaseKind: string;
  /** One-line instruction above the board during targeting phases. */
  banner: string | null;
  /** Per-cell role for highlight styling. */
  roleOf: (idx: number) => CellRole;
  /** Cells that respond to a tap right now. */
  isTappable: (idx: number) => boolean;
  onCellTap: (idx: number) => void;
  /** Buttons for the action bar. */
  actions: PhaseAction[];
  bonusDialog: BonusDialogUI | null;
  isGameOver: boolean;
}

const SUIT_PERK_LABEL: Record<Suit, string> = {
  H: '♥ Swap',
  S: '♠ Slide',
  D: '♦ Destroy',
  C: '♣ Bonus',
};

const EMPTY_SET: ReadonlySet<number> = new Set();

/**
 * The ONLY place in the UI that switches on `state.phase`. Translates the
 * reducer's phase union into a flat "what can the player tap and what does
 * it do" description that every board/bar/dialog component consumes.
 *
 * Special-card (Three Tricks) and Mixed Bag phases are not reachable in
 * free play; they fall through to a cancel-only mode until the challenge
 * UI lands in Phase 4.
 */
export function usePhaseUI(): PhaseUI {
  const { state, dispatch } = useGameSession();
  const phase = state.phase;

  // Hop is the one targeting flow with a UI-side selection step (the
  // reducer only knows completed pairs). Reset it whenever the phase
  // object changes.
  const [hopFirst, setHopFirst] = useState<number | null>(null);
  useEffect(() => {
    setHopFirst(null);
  }, [phase]);

  return useMemo<PhaseUI>(() => {
    const cancelAction: PhaseAction = {
      id: 'cancel',
      label: 'Cancel',
      variant: 'ghost',
      onPress: () => dispatch({ type: 'CANCEL_ACTION' }),
    };

    const base = {
      phaseKind: phase.kind,
      banner: null as string | null,
      bonusDialog: null as BonusDialogUI | null,
      isGameOver: false,
      actions: [] as PhaseAction[],
      onCellTap: (_idx: number) => {},
    };

    const fromSets = (
      tappable: ReadonlySet<number>,
      selected: ReadonlySet<number> = EMPTY_SET,
      nextSlot: number | null = null
    ) => ({
      roleOf: (idx: number): CellRole =>
        selected.has(idx)
          ? 'selected'
          : tappable.has(idx)
            ? 'target'
            : idx === nextSlot
              ? 'next'
              : null,
      isTappable: (idx: number) => tappable.has(idx),
    });

    switch (phase.kind) {
      case 'awaiting-action': {
        const drawn = state.drawn;
        const next = nextSpiralSlot(state.grid);
        const actions: PhaseAction[] = [];
        if (drawn) {
          actions.push({
            id: 'place',
            label: 'Place',
            variant: 'primary',
            onPress: () => dispatch({ type: 'PLACE' }),
          });
          if (!isJoker(drawn)) {
            const suitOK = suitActionAvailable(
              drawn,
              state.grid,
              state.bonusDeck.length,
              state.bonusCards.length,
              state.noSwap
            );
            actions.push({
              id: 'perk',
              label: SUIT_PERK_LABEL[drawn.suit],
              variant: 'secondary',
              disabled: !suitOK,
              onPress: () => dispatch({ type: 'BEGIN_SUIT_ACTION' }),
            });
            if (!state.noDiscards) {
              actions.push({
                id: 'discard',
                label: 'Discard',
                variant: 'ghost',
                onPress: () => dispatch({ type: 'DISCARD_NONE' }),
              });
            }
          }
        }
        return {
          ...base,
          ...fromSets(EMPTY_SET, EMPTY_SET, next),
          actions,
        };
      }

      case 'awaiting-target-hop': {
        const inAnyPair = new Set<number>();
        for (const [i, j] of phase.pairs) {
          inAnyPair.add(i);
          inAnyPair.add(j);
        }
        if (hopFirst === null) {
          return {
            ...base,
            banner: '♥ Swap — tap the first card',
            ...fromSets(inAnyPair),
            onCellTap: idx => {
              if (inAnyPair.has(idx)) setHopFirst(idx);
            },
            actions: [cancelAction],
          };
        }
        const partners = new Set<number>();
        for (const [i, j] of phase.pairs) {
          if (i === hopFirst) partners.add(j);
          if (j === hopFirst) partners.add(i);
        }
        const tappable = new Set(partners);
        tappable.add(hopFirst); // tap again to deselect
        return {
          ...base,
          banner: '♥ Swap — tap a card in the same row or column',
          ...fromSets(tappable, new Set([hopFirst])),
          onCellTap: idx => {
            if (idx === hopFirst) {
              setHopFirst(null);
              return;
            }
            if (!partners.has(idx)) return;
            const pair = phase.pairs.find(
              ([i, j]) =>
                (i === hopFirst && j === idx) || (i === idx && j === hopFirst)
            );
            if (pair) dispatch({ type: 'RESOLVE_HOP', i: pair[0], j: pair[1] });
          },
          actions: [cancelAction],
        };
      }

      case 'awaiting-target-slide-source': {
        const sources = new Set(phase.sources);
        return {
          ...base,
          banner: '♠ Slide — tap the card (or chain) to move',
          ...fromSets(sources),
          onCellTap: idx => {
            if (sources.has(idx)) {
              dispatch({ type: 'SLIDE_SELECT_SOURCE', slot: idx });
            }
          },
          actions: [cancelAction],
        };
      }

      case 'awaiting-target-slide-dest': {
        const dests = new Set(phase.moves.map(m => m.leadingDest));
        const source = phase.source;
        return {
          ...base,
          banner: '♠ Slide — tap where the leading card should land',
          ...fromSets(dests, new Set([source])),
          onCellTap: idx => {
            const move = phase.moves.find(m => m.leadingDest === idx);
            if (move) {
              dispatch({
                type: 'RESOLVE_SLIDE',
                from: move.from,
                direction: move.direction,
                distance: move.distance,
              });
            }
          },
          actions: [cancelAction],
        };
      }

      case 'awaiting-target-destroy': {
        const targets = new Set(phase.targets);
        return {
          ...base,
          banner: '♦ Destroy — tap the card to remove',
          ...fromSets(targets),
          onCellTap: idx => {
            if (targets.has(idx)) dispatch({ type: 'RESOLVE_DESTROY', slot: idx });
          },
          actions: [cancelAction],
        };
      }

      case 'bonus-card-resolving': {
        const atCap =
          phase.targetSlot === undefined &&
          state.bonusCards.length >= 3; /* BONUS_HAND_LIMIT */
        return {
          ...base,
          ...fromSets(EMPTY_SET),
          bonusDialog: {
            mode: 'resolving',
            drawn: phase.drawn,
            atCap,
            canDecline:
              !state.randomPerks &&
              phase.targetSlot === undefined &&
              (!atCap || state.bonusDeclineAllowed),
          },
        };
      }

      case 'bonus-card-replacing': {
        return {
          ...base,
          ...fromSets(EMPTY_SET),
          bonusDialog: {
            mode: 'replacing',
            drawn: phase.drawn,
            pickedNew: phase.pickedNew,
            atCap: true,
            canDecline: false,
          },
        };
      }

      case 'game-over':
        return { ...base, ...fromSets(EMPTY_SET), isGameOver: true };

      // Challenge-only phases (Three Tricks specials, Mixed Bag slot
      // choice). Unreachable in free play; render a cancel-only board
      // until their UI ships with the challenges feature.
      default:
        return {
          ...base,
          banner: 'This action is not supported yet.',
          ...fromSets(EMPTY_SET),
          actions: [cancelAction],
        };
    }
  }, [phase, state, dispatch, hopFirst]);
}
