import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { bonusShapleyValues, scoreGrid } from '../../../game/scoring';
import type { Achievement } from '../../../game/achievements';
import { Sheet, useToast } from '../../../design/primitives';
import { buildShareUrl, shareUrl } from '../../../lib/share';
import { isBackendConfigured } from '../../../lib/supabaseRpc';
import { SKIN_CATALOG, SkinUnlock } from '../../../design/skinCatalog';
import { SuitKey } from '../../../design/deckSkins';
import { useTier } from '../../../app/useTier';
import { useGameSession } from '../GameSessionProvider';
import { useGameFamily } from '../useGameFamily';
import { useRecordResult } from '../../progress/useRecordResult';
import {
  useLevelUp,
  usePlayerLevel,
  useXpEarned,
} from '../../progress/usePlayerLevel';
import { useTargetsResult } from '../useTargetsResult';
import { recordDailyCompletion } from '../../daily/sync/sync';
import { HandleEditor, RankPanel } from '../../daily/RankPanel';
import { useHandle } from '../../daily/sync/handleStore';
import { useSettingsStore } from '../../settings/settingsStore';
import { prefersReducedMotion } from '../useAnimatedNumber';
import { skinFace } from './skinFace';
import { TIER_RULES } from './TierBreakdownSheet';
import styles from './DesktopResultDialog.module.css';

export interface DesktopResultDialogProps {
  /** Scrim visible? The component itself stays mounted from the moment
   *  the game ends so its one-shot recording effects always run. */
  open: boolean;
  /** "View Grid" — close the dialog, revealing the finished board. */
  onViewGrid: () => void;
  /** Free play / challenge: restart this run. Targets Up: remount the
   *  run page, which re-reads the (advanced or cleared) ladder save.
   *  Daily routes to the archive instead. */
  onReplay: () => void;
}

const tierLabel = (tier: string): string =>
  TIER_RULES.find(r => r.tier === tier)?.label ?? '';

// A real card face at thumbnail size — the deck-unlock showcase and the
// "next unlock" teaser render the actual skin (skinFace), not an icon.
function MiniFace({
  id,
  rank,
  suit,
  size,
  className,
}: {
  id: string;
  rank: string;
  suit: SuitKey;
  size: number;
  className?: string;
}) {
  const four = !useSettingsStore(s => s.twoColorDeck);
  const mobile = useTier() === 'phone';
  const face = skinFace(id, rank, suit, four, mobile);
  return (
    <span
      className={className}
      style={{ ...face.wrap, width: size, height: size, flex: 'none' }}
      aria-hidden="true"
    >
      {face.layers.map((l, i) => (
        <span key={i} style={l.style}>
          {l.glyph}
          {l.kids.map((k, j) => (
            <span key={j} style={k.style}>
              {k.glyph}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

// The unlock showcase fans A♥ / K♠ / Q♦ — one design each for a group,
// three ranks of the same design for a single-skin entry.
const FAN: { rank: string; suit: SuitKey }[] = [
  { rank: 'A', suit: 'h' },
  { rank: 'K', suit: 's' },
  { rank: 'Q', suit: 'd' },
];
const fanSkinIds = (unlock: SkinUnlock): string[] =>
  unlock.skinIds.length >= 3
    ? unlock.skinIds.slice(0, 3)
    : unlock.skinIds.length === 2
      ? unlock.skinIds
      : [unlock.skinIds[0], unlock.skinIds[0], unlock.skinIds[0]];

/**
 * The ≥1024px game-over overlay (mockup lines 228–260): the finished
 * three-column view stays behind an ink scrim while a compact verdict
 * card takes the middle — gradient header with the tier letter, the
 * score against its target, the score math, the daily handle claim,
 * and the mode's continue actions. Owns the SAME result-recording side
 * effects ResultView runs on mobile (stats, achievements, the daily
 * submit, the Targets-Up ladder advance) — it is the desktop result
 * surface, not just a skin.
 */
export function DesktopResultDialog({
  open,
  onViewGrid,
  onReplay,
}: DesktopResultDialogProps) {
  const { state, mode, setup, seed, viewOnly } = useGameSession();
  const { toast } = useToast();

  const { report, shapley } = useMemo(() => {
    const options = {
      deckRemaining: state.deck.length,
      discards: state.discards,
      perkSpent: state.perkSpent,
      handBoost: state.handBoost,
    };
    return {
      report: scoreGrid(state.grid, state.bonusCards, options),
      shapley: bonusShapleyValues(state.grid, state.bonusCards, options),
    };
  }, [state]);

  const { won, tier, newAchievements } = useRecordResult(report, shapley);
  const levelUp = useLevelUp(viewOnly);
  // XP this run earned, split by source. In the archive view (viewOnly)
  // the hook reconstructs the recorded daily play's own XP from its
  // score/won record instead of the live before/after diff.
  const xpEarned = useXpEarned(viewOnly, { score: report.total, won });
  const [xpOpen, setXpOpen] = useState(false);
  // Targets-Up ladder lifecycle — the hook shared with mobile's
  // ResultView; its module-level guard keeps the advance/clear commit
  // single-owner even if both surfaces mount across a resize.
  const targetsFlow = useTargetsResult(won, tier);
  // Tapped just-earned achievement → explainer sheet (mobile parity).
  const [achInfo, setAchInfo] = useState<Achievement | null>(null);

  // Daily: save locally, then queue-first submit (mirrors ResultView).
  // Never for a re-hydrated archive view — that play is already saved.
  const dailyRecordedRef = useRef(false);
  useEffect(() => {
    if (mode.kind !== 'daily' || dailyRecordedRef.current || viewOnly) return;
    dailyRecordedRef.current = true;
    recordDailyCompletion(mode.dateISO, mode.recipe, state, report.total, won);
  }, [mode, state, report.total, won, viewOnly]);

  // Esc = View Grid (the dialog's only dismissal).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onViewGrid();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onViewGrid]);

  const isDaily = mode.kind === 'daily';
  const isChallenge = mode.kind === 'challenge';
  const isTargets = mode.kind === 'targets';
  // The daily rank row is a COLUMN-family (mobile) affordance only: the
  // desk / desk-lite game surfaces already carry the leaderboard in the
  // left rail, so showing it in their result popup would be redundant
  // (and would change the desktop result — kept byte-identical).
  const columnFamily = useGameFamily() === 'column';
  // Reactive: the claim box swaps to "Posted as …" the instant the
  // editor's save lands (and the leaderboard panel renames with it).
  const savedHandle = useHandle();

  const verdict = isChallenge
    ? won
      ? 'Challenge beaten'
      : 'Challenge missed'
    : isTargets
      ? won
        ? `Level ${mode.level} cleared`
        : `Run ended — level ${mode.level}`
      : won
        ? 'Target cleared'
        : 'Just short';

  // ---- Progression module data (replaces the old highlights list) ----
  // Every level unlocks a catalog entry, so a level-up always has a deck
  // to celebrate and the everyday case always has a next deck to tease.
  const levelInfo = usePlayerLevel();
  const unlocked =
    levelUp !== null ? (SKIN_CATALOG.find(u => u.level === levelUp) ?? null) : null;
  const nextUnlock =
    SKIN_CATALOG.find(u => u.level === levelInfo.level + 1) ?? null;
  const earnedXp = xpEarned?.total ?? 0;

  // Bar segments: the pre-run fill plus this game's gain. A level-up
  // resets the bar to the fresh level (all-new sliver).
  const span = levelInfo.levelSpan ?? 1;
  const postPct = Math.round(levelInfo.progress * 100);
  const prePct = levelInfo.atMax
    ? 100
    : levelUp !== null
      ? 0
      : Math.round(
          (Math.max(0, levelInfo.xpIntoLevel - earnedXp) / span) * 100
        );
  const gainPct = Math.max(0, postPct - prePct);

  // The gained segment sweeps in shortly after the dialog lands (skipped
  // under reduced motion — final widths render immediately).
  const reduceMotion =
    useSettingsStore(s => s.reduceMotion) || prefersReducedMotion();
  const [xpArmed, setXpArmed] = useState(false);
  useEffect(() => {
    if (!open || reduceMotion) return;
    const t = window.setTimeout(() => setXpArmed(true), 400);
    return () => window.clearTimeout(t);
  }, [open, reduceMotion]);
  const xpSettled = reduceMotion || xpArmed;

  // Equip-from-the-popup: wears the unlocked entry's first design.
  const deckSkin = useSettingsStore(s => s.deckSkin);
  const setSettings = useSettingsStore(s => s.set);
  const equipped =
    unlocked !== null && deckSkin !== null && unlocked.skinIds.includes(deckSkin);
  const equip = () => {
    if (unlocked) setSettings({ deckSkin: unlocked.skinIds[0] });
  };

  const onShare = async () => {
    const url = buildShareUrl({
      score: report.total,
      mode: isTargets
        ? 'targets-up'
        : isChallenge
          ? 'challenge'
          : isDaily
            ? 'daily'
            : 'free',
      difficulty: state.difficulty,
      grid: state.grid,
      dateISO: isDaily && mode.kind === 'daily' ? mode.dateISO : undefined,
      seed: mode.kind === 'free' ? seed : undefined,
    });
    const result = await shareUrl(url, `PokerGrid — ${report.total} points`);
    if (result.outcome === 'copied') toast('Link copied.', 'success');
    else if (result.outcome === 'failed') toast('Could not share.', 'danger');
  };

  // Targets Up: exactly ONE contextual primary next to View Grid —
  // Choose Reward(s) (S/SS win, picks pending) → the shared
  // RewardsSheet; Next Round (won, picks done or none earned); Play
  // Again (lost — the save is already cleared, so the remount starts
  // the run over at level 1).
  const targetsPrimary = targetsFlow.rewardsPending ? (
    <button
      type="button"
      className={styles.primaryBtn}
      onClick={targetsFlow.openRewards}
    >
      {targetsFlow.rewardCount === 2 ? 'Choose Rewards' : 'Choose Reward'}
    </button>
  ) : (
    <button type="button" className={styles.primaryBtn} onClick={onReplay}>
      {won ? 'Next Round' : 'Play Again'}
    </button>
  );

  if (!open) {
    // Keep the RewardsSheet reachable even while the player inspects
    // the grid — it is a top-layer <dialog>, independent of the scrim.
    return <>{targetsFlow.rewardsSheet}</>;
  }

  return (
    <div className={styles.scrim}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label="Game result"
      >
        {/* Slim header band: verdict + tier label left; the score (vs its
            target) and the tier badge right — the score lives up here now,
            so the body opens straight into progression. */}
        <div className={`${styles.head} ${won ? styles.headWin : styles.headLoss}`}>
          <div className={styles.headText}>
            <span className={styles.verdict}>{verdict}</span>
            <span className={styles.tierLabel}>
              {tierLabel(tier)}
              {isChallenge && setup.challenge ? (
                <span className={styles.headContext}>
                  {' '}
                  · <span aria-hidden="true">✦</span> {setup.challenge.name}
                </span>
              ) : null}
            </span>
          </div>
          <div className={styles.headRight}>
            <span
              className={styles.headScore}
              aria-label={`Score ${report.total} of target ${state.target}`}
            >
              <span data-testid="final-score">{report.total}</span>
              <span className={styles.headTarget}>/ {state.target}</span>
            </span>
            <span className={styles.tierBadge} aria-label={`Tier ${tier}`}>
              {tier}
            </span>
          </div>
        </div>
        <div className={styles.body}>
          {/* Meta row, straight under the header: this game's XP (with
              the mini progress bar to the next level) on the left, the
              daily standing + posted-as handle right-aligned opposite.
              Archive re-views (viewOnly) still show the recorded daily
              play's own XP and its standing — but not the live level
              bar, which tracks TODAY'S progress, not that run's. */}
          {(!viewOnly || isDaily) && (
            <div className={styles.metaRow}>
              <div className={styles.metaXp}>
                {earnedXp > 0 && (
                  <button
                    type="button"
                    className={styles.xpGain}
                    onClick={() => setXpOpen(true)}
                    aria-label={`Earned ${earnedXp} XP this game — show breakdown`}
                  >
                    <span aria-hidden="true">✨</span> +{earnedXp} XP
                    <span className={styles.xpHint} aria-hidden="true">
                      ⓘ
                    </span>
                  </button>
                )}
                {!viewOnly && (
                  <>
                    <div className={styles.miniTrack}>
                      {prePct > 0 && (
                        <div
                          className={styles.xpFillOld}
                          style={{ width: `${prePct}%` }}
                        />
                      )}
                      {gainPct > 0 && (
                        <div
                          className={styles.xpFillNew}
                          style={{
                            left: `${prePct}%`,
                            width: xpSettled ? `${gainPct}%` : '0%',
                          }}
                        />
                      )}
                    </div>
                    <span className={styles.miniCap}>
                      {levelInfo.atMax
                        ? `Level ${levelInfo.level} · Max level`
                        : levelUp !== null
                          ? `Level ${levelInfo.level} · ${levelInfo.xpIntoLevel.toLocaleString()} / ${span.toLocaleString()} XP`
                          : `Level ${levelInfo.level} · ${(
                              span - levelInfo.xpIntoLevel
                            ).toLocaleString()} to Level ${levelInfo.level + 1}`}
                    </span>
                  </>
                )}
              </div>
              {mode.kind === 'daily' && isBackendConfigured() && (
                <div className={styles.metaRight}>
                  <RankPanel dateISO={mode.dateISO} placementOnly />
                  {savedHandle && (
                    <span className={styles.postedLine}>
                      <span aria-hidden="true">✓</span> Posted as {savedHandle}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Next-deck teaser — everyday desk games only (a level-up's
              celebration below shows the new deck instead; mobile stays
              minimal). */}
          {!viewOnly && !columnFamily && unlocked === null && nextUnlock && (
            <div className={styles.teaser}>
              <MiniFace
                id={nextUnlock.skinIds[0]}
                rank="J"
                suit="c"
                size={34}
                className={styles.nextFace}
              />
              <span className={styles.nextText}>
                <b>Next unlock — {nextUnlock.name} deck</b>
                <i>
                  Reach Level {nextUnlock.level}
                  {nextUnlock.skinIds.length > 1
                    ? ` · ${nextUnlock.skinIds.length} designs`
                    : ''}
                </i>
              </span>
              <span className={styles.lockGlyph} aria-hidden="true">
                🔒
              </span>
            </div>
          )}

          {/* Celebrations, with breathing room under the meta row: the
              deck-unlock container, then any achievements in the same
              accent-themed dress. */}
          {!viewOnly && unlocked !== null && (
            <div className={columnFamily ? styles.unlockRow : styles.unlock} role="status">
              {columnFamily ? (
                <>
                  <MiniFace
                    id={unlocked.skinIds[0]}
                    rank="A"
                    suit="h"
                    size={40}
                  />
                  <span className={styles.unlockRowText}>
                    <b>
                      Level {levelUp} — {unlocked.name} deck unlocked
                    </b>
                    <i>
                      {unlocked.skinIds.length > 1
                        ? `${unlocked.skinIds.length} designs added to your collection`
                        : 'Added to your collection'}
                    </i>
                  </span>
                  <button
                    type="button"
                    className={styles.equipMini}
                    onClick={equip}
                    disabled={equipped}
                    aria-label={`Equip the ${unlocked.name} deck`}
                  >
                    {equipped ? '✓' : 'Equip'}
                  </button>
                </>
              ) : (
                <>
                  <span className={styles.unlockEyebrow}>
                    <span aria-hidden="true">⬆</span> Level {levelUp} reached
                  </span>
                  <span className={styles.unlockTitle}>New deck unlocked</span>
                  <span className={styles.unlockName}>
                    {unlocked.name}
                    {unlocked.skinIds.length > 1
                      ? ` · ${unlocked.skinIds.length} designs`
                      : ''}
                  </span>
                  <div
                    className={`${styles.fan} ${
                      fanSkinIds(unlocked).length === 2 ? styles.fanTwo : ''
                    }`}
                  >
                    {fanSkinIds(unlocked).map((id, i) => (
                      <MiniFace
                        key={i}
                        id={id}
                        rank={FAN[i].rank}
                        suit={FAN[i].suit}
                        size={76}
                        className={`${styles.fanCard} ${styles[`fan${i}`]}`}
                      />
                    ))}
                  </div>
                  <div className={styles.unlockActions}>
                    <button
                      type="button"
                      className={styles.equipBtn}
                      onClick={equip}
                      disabled={equipped}
                      aria-label={`Equip the ${unlocked.name} deck`}
                    >
                      {equipped ? '✓ Equipped' : 'Equip deck'}
                    </button>
                    <Link to="/settings?decks=1" className={styles.quietLink}>
                      All decks
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}
          {/* Just-earned achievements — the level-up container's sibling:
              same accent-tinted dress. Desk: eyebrow + serif name(s) +
              (single achievement) inline description. Mobile: a compact
              row matching the deck-unlock row. Names stay tappable for
              the explainer sheet, with the hover tooltip on desk. */}
          {newAchievements.length > 0 &&
            (columnFamily ? (
              newAchievements.map(a => (
                <button
                  key={a.id}
                  type="button"
                  className={`${styles.unlockRow} ${styles.achRow}`}
                  onClick={() => setAchInfo(a)}
                >
                  <span className={styles.achRowIcon} aria-hidden="true">
                    🏆
                  </span>
                  <span className={styles.unlockRowText}>
                    <b>{a.name}</b>
                    <i>Achievement unlocked</i>
                  </span>
                </button>
              ))
            ) : (
              <div className={styles.achBox} role="status">
                <span className={styles.unlockEyebrow}>
                  <span aria-hidden="true">🏆</span>{' '}
                  {newAchievements.length > 1
                    ? 'Achievements unlocked'
                    : 'Achievement unlocked'}
                </span>
                <span className={styles.achNames}>
                  {newAchievements.map(a => (
                    <button
                      key={a.id}
                      type="button"
                      className={styles.achievementBtn}
                      onClick={() => setAchInfo(a)}
                    >
                      {a.name}
                      {/* Hover/focus explainer — the dark tooltip
                          pattern; click still opens the full sheet. */}
                      <span className={styles.achTip} role="tooltip">
                        {a.description}
                      </span>
                    </button>
                  ))}
                </span>
                {newAchievements.length === 1 && (
                  <span className={styles.achDesc}>
                    {newAchievements[0].description}
                  </span>
                )}
              </div>
            ))}

          {/* First-time handle claim (once saved, "Posted as …" lives in
              the meta row instead). */}
          {isDaily && isBackendConfigured() && !savedHandle && (
            <div className={styles.claim}>
              <span className={styles.claimTitle}>
                Claim your spot on the leaderboard
              </span>
              <span className={styles.claimSub}>
                Pick a handle to post this score and track your daily
                streak.
              </span>
              <HandleEditor heading={null} />
            </div>
          )}
          <div className={styles.footer}>
            {isDaily ? (
              <Link to="/daily/archive" className={styles.primaryBtn}>
                Play Again
              </Link>
            ) : isTargets ? (
              targetsPrimary
            ) : (
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={onReplay}
              >
                {isChallenge && !won ? 'Retry challenge' : 'Play Again'}
              </button>
            )}
            {!isTargets && (
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={onShare}
              >
                Share result
              </button>
            )}
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={onViewGrid}
            >
              View Grid
            </button>
          </div>
          {(isChallenge || isTargets) && (
            <div className={styles.quietRow}>
              {isChallenge ? (
                <Link to="/challenges" className={styles.quietLink}>
                  All challenges
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.quietLink}
                    onClick={onShare}
                  >
                    Share result
                  </button>
                  <Link to="/targets" className={styles.quietLink}>
                    Targets Up home
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <Sheet
        open={achInfo !== null}
        onClose={() => setAchInfo(null)}
        title={achInfo ? `🏆 ${achInfo.name}` : ''}
      >
        {achInfo && <p className="text-body">{achInfo.description}</p>}
      </Sheet>
      <Sheet open={xpOpen} onClose={() => setXpOpen(false)} title="XP earned">
        {xpEarned && (
          <div className={styles.xpBreakdown}>
            {xpEarned.items.map(i => (
              <div key={i.bucket} className={styles.xpBreakRow}>
                <span>{i.label}</span>
                <span>+{i.xp}</span>
              </div>
            ))}
            <div className={`${styles.xpBreakRow} ${styles.xpBreakTotal}`}>
              <span>Total</span>
              <span>+{xpEarned.total} XP</span>
            </div>
          </div>
        )}
      </Sheet>
      {targetsFlow.rewardsSheet}
    </div>
  );
}
