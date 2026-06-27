import { useState } from 'react';
import { motion } from 'motion/react';
import { BonusCard, isPlaceholder, isSpecialCard, powerUpBonusCard } from '../../../game/bonusCards';
import { Card, Supercharge, isJoker } from '../../../game/cards';
import { Grid } from '../../../game/grid';
import { Button, Sheet } from '../../../design/primitives';
import { Tier } from '../../../lib/stats';
import { colors } from '../../../design/tokens';
import { GridBoard } from './GridBoard';
import { BonusChip } from './BonusCardStrip';
import { CardFace } from './CardFace';

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

// After a pick, the chosen card's transformation plays before the flow
// continues — so the upgrade is something the player sees happen.
type Reveal =
  | { kind: 'grid'; card: Card; onContinue: () => void }
  | { kind: 'bonus'; from: BonusCard; to: BonusCard; onContinue: () => void };

const chargeTone = (s: Supercharge): string =>
  s === 'wild' ? colors.joker : colors.warn;

/**
 * Targets-Up S/SS reward picker. S: pick ONE — supercharge a grid card
 * (50/50 wild or double, rolled at tap time) OR power up a held bonus
 * card. SS: both, grid first. The sheet can't be dismissed without
 * choosing (a skip is offered when a side has nothing eligible). Each
 * pick plays a short transform animation before continuing.
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
  const [reveal, setReveal] = useState<Reveal | null>(null);

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
    const advanceToBonus = tier === 'SS' && eligibleBonus.length > 0;
    setReveal({
      kind: 'grid',
      card: charged,
      onContinue: () => {
        if (advanceToBonus) {
          setGridPick(charged);
          setStage('bonus');
          setReveal(null);
        } else {
          onDone({ superchargedCard: charged });
        }
      },
    });
  };

  const pickBonus = (card: BonusCard) => {
    const powered = powerUpBonusCard(card);
    setReveal({
      kind: 'bonus',
      from: card,
      to: powered,
      onContinue: () =>
        onDone({
          superchargedCard: gridPick ?? undefined,
          poweredBonus: powered,
        }),
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
        {reveal ? (
          <RevealView reveal={reveal} />
        ) : gridStage ? (
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

function RevealView({ reveal }: { reveal: Reveal }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: '12px 0',
      }}
    >
      {reveal.kind === 'grid' ? (
        <GridReveal card={reveal.card} />
      ) : (
        <BonusReveal from={reveal.from} to={reveal.to} />
      )}
      <Button variant="primary" onClick={reveal.onContinue}>
        Continue
      </Button>
    </div>
  );
}

function GridReveal({ card }: { card: Card }) {
  const charge = isJoker(card) ? undefined : card.supercharge;
  const tone = charge ? chargeTone(charge) : colors.accent;
  return (
    <>
      <div style={{ position: 'relative', width: 96, height: 96 }}>
        {/* Bloom ring that radiates out as the card lands. */}
        <motion.span
          aria-hidden
          initial={{ opacity: 0.55, scale: 0.7 }}
          animate={{ opacity: 0, scale: 1.9 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            inset: -6,
            borderRadius: 16,
            boxShadow: `0 0 0 3px ${tone}`,
          }}
        />
        <motion.div
          initial={{ scale: 0.6, rotateY: 90 }}
          animate={{ scale: 1, rotateY: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 18 }}
          style={{ width: 96, height: 96 }}
        >
          <CardFace card={card} />
        </motion.div>
      </div>
      <motion.p
        className="text-body"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{ fontWeight: 700, color: tone, margin: 0 }}
      >
        {charge === 'wild'
          ? 'Wild! Its suit is now flexible.'
          : 'Doubled! It counts twice for pairs.'}
      </motion.p>
    </>
  );
}

function BonusReveal({ from, to }: { from: BonusCard; to: BonusCard }) {
  return (
    <>
      <div style={{ maxWidth: 220, width: '100%' }}>
        <BonusChip card={to} />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span style={{ fontSize: 20, color: colors.ink3 }}>{from.mult}</span>
        <span style={{ color: colors.ink3 }}>→</span>
        <motion.span
          key={to.mult}
          initial={{ scale: 0.5, color: colors.warn }}
          animate={{ scale: 1, color: colors.accent }}
          transition={{ type: 'spring', stiffness: 280, damping: 16 }}
          style={{ fontSize: 28, fontWeight: 800 }}
        >
          {to.mult}
        </motion.span>
      </div>
      <motion.p
        className="text-body"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{ fontWeight: 700, color: colors.accent, margin: 0 }}
      >
        Powered up!
      </motion.p>
    </>
  );
}
