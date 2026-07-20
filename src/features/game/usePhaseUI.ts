import { useEffect, useMemo, useState } from 'react';
import {
  MEGA_DESTROY_MAX,
  REWIND_PICK_MAX,
  REWIND_PICK_MIN,
  SHUFFLE_PICK_MAX,
  SHUFFLE_PICK_MIN,
  anyPerkAvailable,
  canDeselectSideSlideSlot,
  sideSlideChainExtensions,
  sideSlideTapTargets,
  suitActionAvailable,
} from '../../game/actions';
import { Suit, isJoker } from '../../game/cards';
import { HandRank } from '../../game/hands';
import { nextSpiralSlot } from '../../game/grid';
import {
  BonusCard,
  cardMatchesSlot,
  isPlaceholder,
} from '../../game/bonusCards';
import { slotDrawable } from '../../game/state';
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
  /**
   * replacing only: whether the player may step back to the card-select
   * screen. True when declining the forced swap is allowed (easy mode) —
   * so they can reach the decline option after picking a new card.
   */
  canGoBack?: boolean;
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
  /** Bull Market: the ♣ invest spin wheel — the hand + amount to reveal. */
  clubInvest: { hand: HandRank; amount: number } | null;
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

    // Short Circuit: a revealed random perk is committed — no Cancel
    // out of its targeting phases (the reducer rejects CANCEL_ACTION
    // there too, this just hides the dead button). Cancel that only
    // steps back WITHIN a flow (slide dest → source) stays.
    const lockedPerkActions = (actions: PhaseAction[]) =>
      state.randomPerks ? actions.filter(a => a.id !== 'cancel') : actions;

    const base = {
      phaseKind: phase.kind,
      banner: null as string | null,
      bonusDialog: null as BonusDialogUI | null,
      clubInvest: null as { hand: HandRank; amount: number } | null,
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
        // Scatter highlights the pre-rolled random slot; otherwise the
        // spiral's next slot.
        const next = state.scatter
          ? state.scatterSlot
          : nextSpiralSlot(state.grid);
        const actions: PhaseAction[] = [];
        if (drawn) {
          actions.push({
            id: 'place',
            label: 'Place',
            variant: 'primary',
            onPress: () => dispatch({ type: 'PLACE' }),
          });
          if (!isJoker(drawn)) {
            // Mirror handleBeginSuitAction's availability exactly:
            //  - Short Circuit fires a RANDOM available perk, so the button
            //    stays live while ANY perk is legal (not just the drawn
            //    suit's — anyPerkAvailable).
            //  - Mixed Bag's ♣ is exempt from the at-cap rule (its hand is
            //    full of placeholders from turn 1); it needs a drawable
            //    slot instead.
            const suitOK = state.randomPerks
              ? anyPerkAvailable(
                  state.grid,
                  state.bonusDeck.length,
                  state.bonusCards.length,
                  state.bonusSwapAtCap === 'off'
                )
              : suitActionAvailable(
                  drawn,
                  state.grid,
                  state.bonusDeck.length,
                  state.bonusCards.length,
                  state.bonusSwapAtCap === 'off',
                  state.investHands,
                  state.slotCategories
                    ? state.slotCategories.some(
                        (kind, i) =>
                          // slotDrawable: spent slots are gone, and under
                          // no-swap rules a live card locks its slot.
                          slotDrawable(state, i) &&
                          state.bonusDeck.some(c => cardMatchesSlot(c, kind))
                      )
                    : null
                );
            const perkLabel = state.randomPerks
              ? '? Perk'
              : state.investHands && drawn.suit === 'C'
                ? '♣ Invest'
                : state.doubleDuty
                  ? // Three side-by-side options — drop the suit glyph so
                    // the label fits ("♥ Swap" → "Swap").
                    SUIT_PERK_LABEL[drawn.suit].replace(/^\S+\s/, '')
                  : SUIT_PERK_LABEL[drawn.suit];
            actions.push({
              id: 'perk',
              label: perkLabel,
              variant: 'secondary',
              disabled: !suitOK,
              onPress: () => dispatch({ type: 'BEGIN_SUIT_ACTION' }),
            });
            if (!state.noDiscards) {
              actions.push({
                id: 'discard',
                label: 'Discard',
                // Outlined like the perk: chrome marks moves that spend
                // the drawn card, plain text marks view-only actions.
                variant: 'secondary',
                onPress: () => dispatch({ type: 'DISCARD_NONE' }),
              });
            }
            // Double Duty: rotate the two-way card so its bottom half
            // becomes active; the next two deck cards are burned unseen.
            // Disabled (not hidden) after a flip / when fewer than two
            // cards remain, so the dock doesn't reflow mid-turn.
            if (state.doubleDuty && drawn.dual) {
              actions.push({
                id: 'flip',
                label: 'Flip',
                variant: 'secondary',
                disabled: state.flippedDrawn || state.deck.length < 2,
                onPress: () => dispatch({ type: 'FLIP_CARD' }),
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
            actions: lockedPerkActions([cancelAction]),
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
          actions: lockedPerkActions([cancelAction]),
        };
      }

      case 'awaiting-target-slide-source': {
        const ui = tapPhase(
          '♠ Slide — tap the card (or chain) to move',
          phase.sources,
          idx => dispatch({ type: 'SLIDE_SELECT_SOURCE', slot: idx })
        );
        return { ...ui, actions: lockedPerkActions(ui.actions) };
      }

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

      case 'awaiting-target-destroy': {
        const ui = tapPhase(
          '♦ Destroy — tap the card to remove',
          phase.targets,
          idx => dispatch({ type: 'RESOLVE_DESTROY', slot: idx })
        );
        return { ...ui, actions: lockedPerkActions(ui.actions) };
      }

      case 'bonus-card-resolving': {
        const atCap =
          phase.targetSlot === undefined &&
          state.bonusCards.length >= 3; /* BONUS_HAND_LIMIT */
        // Mirrors the reducer's handleBonusDecline gates: what matters is
        // whether taking would FILL AN OPEN SPOT or REPLACE a held card.
        // Mixed Bag's categorized draws (targetSlot) answer per-slot —
        // its hand is always 3 entries counting placeholders, so the raw
        // length can't tell.
        const targetOccupant =
          phase.targetSlot !== undefined
            ? state.bonusCards[phase.targetSlot]
            : undefined;
        const fillsOpenSpot =
          phase.targetSlot !== undefined
            ? targetOccupant === undefined || isPlaceholder(targetOccupant)
            : !atCap;
        return {
          ...base,
          ...fromSets(EMPTY_SET),
          isTappable: () => false,
          bonusDialog: {
            mode: 'resolving',
            drawn: phase.drawn,
            atCap,
            // Open spot: declining is a difficulty rule — Easy never
            // needs it (a taken card can always be swapped out later),
            // Medium+ may wave the draw off since taking is binding
            // there. Replacing a held card, only Easy's
            // bonusDeclineAllowed keeps the existing hand.
            canDecline: fillsOpenSpot
              ? state.difficulty !== 'easy'
              : state.bonusDeclineAllowed,
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
            canGoBack: state.bonusDeclineAllowed,
          },
        };

      case 'club-invest':
        return {
          ...base,
          ...fromSets(EMPTY_SET),
          isTappable: () => false,
          clubInvest: { hand: phase.hand, amount: phase.amount },
        };

      case 'awaiting-bonus-slot-choice':
        return {
          ...base,
          banner: '♣ Bonus — tap the slot to draw for',
          ...fromSets(EMPTY_SET),
          isTappable: () => false,
          bonusSlotPick: true,
          actions: lockedPerkActions([cancelAction]),
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

      case 'awaiting-special-side-slide-dest': {
        // Targets are the cells the chain would newly slide onto (always
        // empty cells); a tap commits the shortest move covering that
        // cell — so a plain 1-step slide is one tap on the cell just
        // past the chain. (The old leader-destination mapping made a
        // slide-by-one target a cell INSIDE the chain — unreachable.)
        const targets = sideSlideTapTargets(phase.chain, phase.moves);
        return tapPhase(
          'Slip & Slide — tap a cell the chain should slide onto',
          [...targets.keys()],
          idx => {
            const path = targets.get(idx);
            if (path) dispatch({ type: 'RESOLVE_SIDE_SLIDE', path });
          },
          new Set(phase.chain)
        );
      }

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
