import { useEffect, useMemo, useState } from 'react';
import {
  MEGA_DESTROY_MAX,
  REWIND_PICK_MAX,
  REWIND_PICK_MIN,
  SHUFFLE_PICK_MAX,
  SHUFFLE_PICK_MIN,
  canDeselectSideSlideSlot,
  sideSlideChainExtensions,
  suitActionAvailable,
} from '../../game/actions';
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
  /** One-line instruction shown in the dock during targeting phases. */
  banner: string | null;
  /** Per-cell role for highlight styling. */
  roleOf: (idx: number) => CellRole;
  /** Cells that respond to a tap right now. */
  isTappable: (idx: number) => boolean;
  onCellTap: (idx: number) => void;
  /** Buttons for the dock. */
  actions: PhaseAction[];
  bonusDialog: BonusDialogUI | null;
  /** Revive (special card): pick a card from the discard pile. */
  reviveOpen: boolean;
  /** Mixed Bag: ♣ asks which bonus slot to draw for — chips tappable. */
  bonusSlotPick: boolean;
  /** awaiting-action: held special cards can be activated. */
  canActivateSpecials: boolean;
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
 * The ONLY place in the UI that switches on `state.phase`. Translates
 * the reducer's phase union into a flat "what can the player tap and
 * what does it do" description consumed by the board, dock, and
 * dialogs — including every Three Tricks special-card flow and the
 * Mixed Bag slot choice.
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
      reviveOpen: false,
      bonusSlotPick: false,
      canActivateSpecials: false,
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
      isTappable: (idx: number) => tappable.has(idx) || selected.has(idx),
    });

    // Shared shape for the simple "tap one highlighted cell" phases.
    const tapPhase = (
      banner: string,
      slots: readonly number[],
      onTap: (idx: number) => void,
      selected: ReadonlySet<number> = EMPTY_SET
    ) => {
      const set = new Set(slots);
      return {
        ...base,
        banner,
        ...fromSets(set, selected),
        isTappable: (idx: number) => set.has(idx),
        onCellTap: (idx: number) => {
          if (set.has(idx)) onTap(idx);
        },
        actions: [cancelAction],
      };
    };

    // Shared shape for the multi-select special phases (mega-destroy,
    // shuffle, rewind): toggle cells, then confirm.
    const togglePhase = (
      banner: string,
      slots: readonly number[],
      selected: readonly number[],
      toggle: (idx: number) => void,
      confirmLabel: string,
      confirmEnabled: boolean,
      confirm: () => void
    ) => {
      const tappable = new Set(slots);
      const sel = new Set(selected);
      return {
        ...base,
        banner,
        ...fromSets(tappable, sel),
        isTappable: (idx: number) => tappable.has(idx),
        onCellTap: (idx: number) => {
          if (tappable.has(idx)) toggle(idx);
        },
        actions: [
          {
            id: 'confirm',
            label: confirmLabel,
            variant: 'primary' as const,
            disabled: !confirmEnabled,
            onPress: confirm,
          },
          cancelAction,
        ],
      };
    };

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
              label: state.randomPerks ? '? Perk' : SUIT_PERK_LABEL[drawn.suit],
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
          isTappable: () => false,
          actions,
          canActivateSpecials: true,
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
            isTappable: idx => inAnyPair.has(idx),
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
          isTappable: idx => tappable.has(idx),
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

      case 'awaiting-target-slide-source':
        return tapPhase(
          '♠ Slide — tap the card (or chain) to move',
          phase.sources,
          idx => dispatch({ type: 'SLIDE_SELECT_SOURCE', slot: idx })
        );

      case 'awaiting-target-slide-dest':
        return tapPhase(
          '♠ Slide — tap where the leading card should land',
          phase.moves.map(m => m.leadingDest),
          idx => {
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
          new Set([phase.source])
        );

      case 'awaiting-target-destroy':
        return tapPhase(
          '♦ Destroy — tap the card to remove',
          phase.targets,
          idx => dispatch({ type: 'RESOLVE_DESTROY', slot: idx })
        );

      case 'bonus-card-resolving': {
        const atCap =
          phase.targetSlot === undefined &&
          state.bonusCards.length >= 3; /* BONUS_HAND_LIMIT */
        return {
          ...base,
          ...fromSets(EMPTY_SET),
          isTappable: () => false,
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

      case 'bonus-card-replacing':
        return {
          ...base,
          ...fromSets(EMPTY_SET),
          isTappable: () => false,
          bonusDialog: {
            mode: 'replacing',
            drawn: phase.drawn,
            pickedNew: phase.pickedNew,
            atCap: true,
            canDecline: false,
          },
        };

      case 'awaiting-bonus-slot-choice':
        return {
          ...base,
          banner: '♣ Bonus — tap the slot to draw for',
          ...fromSets(EMPTY_SET),
          isTappable: () => false,
          bonusSlotPick: true,
          actions: [cancelAction],
        };

      // ---- Three Tricks special-card flows ----

      case 'awaiting-special-power-swap-source':
        return tapPhase(
          'Power Swap — tap the first card',
          phase.slots,
          idx => dispatch({ type: 'RESOLVE_POWER_SWAP_SOURCE', slot: idx })
        );

      case 'awaiting-special-power-swap-dest':
        return tapPhase(
          'Power Swap — tap the card to swap with',
          phase.slots,
          idx =>
            dispatch({ type: 'RESOLVE_POWER_SWAP', i: phase.source, j: idx }),
          new Set([phase.source])
        );

      case 'awaiting-special-doubler':
        return tapPhase(
          'Doubler — tap a card to double its rank value',
          phase.slots,
          idx => dispatch({ type: 'RESOLVE_DOUBLER', slot: idx })
        );

      case 'awaiting-special-wildcard':
        return tapPhase(
          'Wildcard — tap a card to make it wild',
          phase.slots,
          idx => dispatch({ type: 'RESOLVE_WILDCARD', slot: idx })
        );

      case 'awaiting-special-mega-destroy':
        return togglePhase(
          `Mega Destroy — pick up to ${MEGA_DESTROY_MAX} cards`,
          phase.slots,
          phase.selected,
          idx => dispatch({ type: 'TOGGLE_MEGA_DESTROY_TARGET', slot: idx }),
          phase.selected.length > 0
            ? `Destroy ${phase.selected.length}`
            : 'Destroy',
          phase.selected.length > 0,
          () => dispatch({ type: 'RESOLVE_MEGA_DESTROY' })
        );

      case 'awaiting-special-side-slide-pick': {
        const selected = phase.selected;
        const extensions = sideSlideChainExtensions(state.grid, selected);
        const tappable = new Set<number>(extensions);
        for (const s of selected) {
          if (canDeselectSideSlideSlot(selected, s)) tappable.add(s);
        }
        if (selected.length === 0) {
          for (let i = 0; i < state.grid.length; i++) {
            if (state.grid[i] !== null) tappable.add(i);
          }
        }
        return togglePhase(
          'Slip & Slide — build a chain of neighboring cards',
          [...tappable],
          selected,
          idx => dispatch({ type: 'TOGGLE_SIDE_SLIDE_PICK', slot: idx }),
          'Choose destination',
          selected.length >= 2,
          () => dispatch({ type: 'SIDE_SLIDE_DONE_PICKING' })
        );
      }

      case 'awaiting-special-side-slide-dest':
        return tapPhase(
          'Slip & Slide — tap where the chain leader should land',
          phase.moves.map(m => m.leadingDest),
          idx => {
            const move = phase.moves.find(m => m.leadingDest === idx);
            if (move) dispatch({ type: 'RESOLVE_SIDE_SLIDE', path: move.path });
          },
          new Set(phase.chain)
        );

      case 'awaiting-special-jump-source':
        return tapPhase(
          'Jump, Jump — tap the card to move',
          phase.sources,
          idx => dispatch({ type: 'RESOLVE_JUMP_SOURCE', slot: idx })
        );

      case 'awaiting-special-jump-dest':
        return tapPhase(
          'Jump, Jump — tap any empty slot to land in',
          phase.dests,
          idx =>
            dispatch({ type: 'RESOLVE_JUMP', source: phase.source, dest: idx }),
          new Set([phase.source])
        );

      case 'awaiting-special-shuffle':
        return togglePhase(
          `Shuffle — pick ${SHUFFLE_PICK_MIN}–${SHUFFLE_PICK_MAX} cards to permute`,
          phase.slots,
          phase.selected,
          idx => dispatch({ type: 'TOGGLE_SHUFFLE_TARGET', slot: idx }),
          'Shuffle',
          phase.selected.length >= SHUFFLE_PICK_MIN &&
            phase.selected.length <= SHUFFLE_PICK_MAX,
          () => dispatch({ type: 'RESOLVE_SHUFFLE' })
        );

      case 'awaiting-special-rewind':
        return togglePhase(
          `Rewind — pick ${REWIND_PICK_MIN}–${REWIND_PICK_MAX} cards to return to the deck`,
          phase.slots,
          phase.selected,
          idx => dispatch({ type: 'TOGGLE_REWIND_TARGET', slot: idx }),
          'Rewind',
          phase.selected.length >= REWIND_PICK_MIN &&
            phase.selected.length <= REWIND_PICK_MAX,
          () => dispatch({ type: 'RESOLVE_REWIND' })
        );

      case 'awaiting-special-plus-minus-target':
        return tapPhase(
          'Plus/Minus — tap a card to shift its rank',
          phase.slots,
          idx => dispatch({ type: 'RESOLVE_PLUS_MINUS_TARGET', slot: idx })
        );

      case 'awaiting-special-plus-minus-direction':
        return {
          ...base,
          banner: 'Plus/Minus — shift the rank up or down',
          ...fromSets(EMPTY_SET, new Set([phase.target])),
          isTappable: () => false,
          actions: [
            {
              id: 'plus',
              label: '+1 rank',
              variant: 'primary',
              onPress: () => dispatch({ type: 'RESOLVE_PLUS_MINUS', delta: 1 }),
            },
            {
              id: 'minus',
              label: '−1 rank',
              variant: 'secondary',
              onPress: () => dispatch({ type: 'RESOLVE_PLUS_MINUS', delta: -1 }),
            },
            cancelAction,
          ],
        };

      case 'awaiting-special-revive-pick':
        return {
          ...base,
          banner: 'Revive — pick a discarded card to bring back',
          ...fromSets(EMPTY_SET),
          isTappable: () => false,
          reviveOpen: true,
          actions: [cancelAction],
        };

      case 'game-over':
        return {
          ...base,
          ...fromSets(EMPTY_SET),
          isTappable: () => false,
          isGameOver: true,
        };
    }
  }, [phase, state, dispatch, hopFirst]);
}
