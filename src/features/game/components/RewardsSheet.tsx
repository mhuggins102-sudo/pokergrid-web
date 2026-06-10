import { useState } from 'react';
import { BonusCard, isPlaceholder, isSpecialCard, powerUpBonusCard } from '../../../game/bonusCards';
import { Card, Supercharge, isJoker } from '../../../game/cards';
import { Grid } from '../../../game/grid';
import { Button, Sheet } from '../../../design/primitives';
import { Tier } from '../../../lib/stats';
import { GridBoard } from './GridBoard';
import { BonusChip } from './BonusCardStrip';

export interface RewardsResult {
  /** Standard card from the final grid, now supercharged — joins the
   *  next level's deck. */
  superchargedCard?: Card;
  /** Held bonus card, powered up — shuffles into the next level's
   *  bonus deck. */
  poweredBonus?: BonusCard;
}

export interface RewardsSheetProps {
  tier: Tier; // 'S' or 'SS'
  grid: Grid;
  bonusCards: BonusCard[];
  /** Base id blocked from a consecutive power-up (cooldown). */
  blockedBaseId: string | null;
  onDone: (result: RewardsResult) => void;
}

const baseIdOf = (c: BonusCard) => c.id.replace(/-pwr\d+$/, '');

/**
 * Targets-Up S/SS reward picker. S: pick ONE — supercharge a grid card
 * (50/50 wild or double, rolled at tap time) OR power up a held bonus
 * card. SS: both, grid first. The sheet can't be dismissed without
 * choosing (a skip is offered when a side has nothing eligible).
 */
export function RewardsSheet({
  tier,
  grid,
  bonusCards,
  blockedBaseId,
  onDone,
}: RewardsSheetProps) {
  const [gridPick, setGridPick] = useState<Card | null>(null);
  const [stage, setStage] = useState<'pick' | 'bonus'>('pick');

  const eligibleBonus = bonusCards.filter(
    c =>
      !isPlaceholder(c) &&
      !isSpecialCard(c) &&
      baseIdOf(c) !== (blockedBaseId ?? '')
  );

  const rollSupercharge = (): Supercharge =>
    Math.random() < 0.5 ? 'wild' : 'double';

  const pickGridCard = (idx: number) => {
    const card = grid[idx];
    if (!card || isJoker(card)) return;
    const charged: Card = { ...card, supercharge: rollSupercharge() };
    if (tier === 'SS' && eligibleBonus.length > 0) {
      setGridPick(charged);
      setStage('bonus');
    } else {
      onDone({ superchargedCard: charged });
    }
  };

  const pickBonus = (card: BonusCard) => {
    const powered = powerUpBonusCard(card);
    onDone({
      superchargedCard: gridPick ?? undefined,
      poweredBonus: powered,
    });
  };

  const gridStage = stage === 'pick';
  const tappable = (idx: number) => {
    const c = grid[idx];
    return gridStage && c !== null && !isJoker(c);
  };

  return (
    <Sheet
      open
      onClose={() => {}}
      dismissible={false}
      title={tier === 'SS' ? 'SS-tier rewards' : 'S-tier reward'}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {gridStage ? (
          <>
            <p className="text-body">
              {tier === 'SS'
                ? 'Reward 1 of 2 — tap a card from the final board to supercharge (wild or double, rolled on pick). It joins your deck next level.'
                : 'Tap a card from the final board to supercharge it for the next level — or power up a held bonus card instead.'}
            </p>
            <GridBoard
              grid={grid}
              roleOf={idx => (tappable(idx) ? 'target' : null)}
              isTappable={tappable}
              onCellTap={pickGridCard}
            />
            {tier === 'S' && eligibleBonus.length > 0 && (
              <>
                <p className="text-label">…or power up a bonus card:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {eligibleBonus.map((c, i) => (
                    <BonusChip key={`${c.id}-${i}`} card={c} onClick={() => pickBonus(c)} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <p className="text-body">
              Reward 2 of 2 — pick a held bonus card to power up. It shuffles
              into next level&apos;s bonus deck.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {eligibleBonus.map((c, i) => (
                <BonusChip key={`${c.id}-${i}`} card={c} onClick={() => pickBonus(c)} />
              ))}
            </div>
            <Button
              variant="ghost"
              onClick={() => onDone({ superchargedCard: gridPick ?? undefined })}
            >
              Skip the power-up
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}
