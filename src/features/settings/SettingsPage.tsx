import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router';
import { Button, Sheet, useToast } from '../../design/primitives';
import { HandleEditor } from '../daily/RankPanel';
import { useHandle } from '../daily/sync/handleStore';
import { resetDailyProgress } from '../daily/sync/sync';
import { clearTwistsSeen } from '../daily/twistSeen';
import { isBackendConfigured } from '../../lib/supabaseRpc';
import { useProgressionStore } from '../progress/progressionStore';
import { useStatsStore } from '../progress/statsStore';
import { useTargetsStore } from '../targets/targetsStore';
import { clearTutorialSeen } from '../tutorial/tutorialSeen';
import {
  Appearance,
  DockLayout,
  Settings,
  ThemeFamily,
  useSettingsStore,
} from './settingsStore';
import { DOCK_LAYOUT_LABEL } from './DockLayoutPreview';
import { DisplayPreview } from './DisplayPreview';
import { SkinStore } from './SkinStore';
import { useTier } from '../../app/useTier';
import { useGameFamily } from '../game/useGameFamily';
import styles from './SettingsPage.module.css';

/*
 * The ONE settings page at every tier (phase 4, plan decision D), per
 * design-refs/desktop/Settings.dc.html: raised sections (Appearance /
 * Game screen / Sound & accessibility / Identity & data — a 2×2 grid
 * ≥1200, one expanded column below) of hairline-separated rows with
 * segmented pickers and pill toggles, plus the live display preview
 * behind the Game screen header's "Preview". All rows read/write the
 * same persisted settings store — no key migrations.
 *
 * Family-conditional rows — both key on useGameFamily (the game THIS
 * viewport would launch), so Settings always matches the gameplay
 * window, including tablet-landscape's desk-lite:
 *  - Dock layout: the column family offers the four column-game
 *    layouts; the desk families offer TWO — Center stage and Compact —
 *    because the desk dock only distinguishes center-stage vs the
 *    compact variant ('hand-stack', 'classic' and 'desktop' render
 *    identically there). Mapping (user directive, unchanged): Center
 *    stage writes 'center-stage'; Compact writes 'hand-stack' only
 *    when coming FROM 'center-stage', so a phone-side Classic choice
 *    survives desk visits.
 *  - Line totals: ONE row binding the family's key — column →
 *    lineRails (the rails the column game reads), desk →
 *    deskLineChips (the desk families' edge chips). Both keys kept.
 */

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      className={`${styles.toggle} ${value ? styles.toggleOn : ''}`}
      onClick={() => onChange(!value)}
    >
      <span className={styles.knob} />
    </button>
  );
}

/* Shared phone-density UI state: whether we're at the phone tier (rows
 * compact and hints move to a Sheet) and the info-sheet opener. */
const SettingsUICtx = createContext<{
  phone: boolean;
  onInfo: (title: string, hint: string) => void;
}>({ phone: false, onInfo: () => {} });

function Row({
  title,
  hint,
  danger,
  children,
}: {
  title: string;
  hint: string;
  danger?: boolean;
  children: ReactNode;
}) {
  const { phone, onInfo } = useContext(SettingsUICtx);
  if (phone) {
    // Compact: title (+ ⓘ opening the hint in a Sheet) on the left, the
    // control on the right of the SAME row; wide segmented controls may
    // wrap below only when they can't fit (the row wraps).
    return (
      <div className={styles.row}>
        <div className={styles.rowHead}>
          <span className={`${styles.rowTitle} ${danger ? styles.danger : ''}`}>
            {title}
          </span>
          <button
            type="button"
            className={styles.infoBtn}
            aria-label={`About ${title}`}
            onClick={() => onInfo(title, hint)}
          >
            ⓘ
          </button>
        </div>
        {children}
      </div>
    );
  }
  return (
    <div className={styles.row}>
      <div>
        <div className={`${styles.rowTitle} ${danger ? styles.danger : ''}`}>
          {title}
        </div>
        <div className={styles.rowHint}>{hint}</div>
      </div>
      {children}
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  /** Optional control on the right end of the section's header bar
   *  (e.g. Game screen's "Preview" opener). */
  action?: ReactNode;
  children: ReactNode;
}) {
  // One expanded rendering at every width — the phone differences live
  // in the Row component (compact rows, ⓘ hints), not the sections.
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <span>{title}</span>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SettingsPage() {
  const tier = useTier();
  // The game family THIS viewport would launch (column vs desk/desk-
  // lite) — the dock picker and Line totals bind to it so Settings
  // always describes the gameplay window that actually appears.
  const deskFamily = useGameFamily() !== 'column';
  const settings = useSettingsStore();
  const resetStats = useStatsStore(s => s.reset);
  const resetProgression = useProgressionStore(s => s.reset);
  const clearTargets = useTargetsStore(s => s.clearProgress);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const [skinStoreOpen, setSkinStoreOpen] = useState(false);
  // Live display sample, opened from the Game screen header's
  // "Preview" (a centered dialog >=640, the bottom sheet on phones).
  const [previewOpen, setPreviewOpen] = useState(false);
  // Reactive handle (the save path notifies) — no local copy to stale.
  const handle = useHandle();
  const [editingHandle, setEditingHandle] = useState(false);
  // Phone: one shared info-sheet, opened by any row's ⓘ button.
  const [infoSheet, setInfoSheet] = useState<{
    title: string;
    hint: string;
  } | null>(null);

  const phone = tier === 'phone';
  const uiCtx = useMemo(
    () => ({
      phone,
      onInfo: (title: string, hint: string) => setInfoSheet({ title, hint }),
    }),
    [phone]
  );

  const patch = (p: Partial<Settings>) => settings.set(p);

  // Escape dismisses the reset confirm (backdrop click does too).
  useEffect(() => {
    if (!confirmReset) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmReset(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmReset]);

  // Desktop dock picker — see the mapping note in the file comment.
  const dockValue =
    settings.dockLayout === 'center-stage' ? 'center-stage' : 'compact';
  const pickDock = (v: 'center-stage' | 'compact') => {
    if (v === 'center-stage') {
      patch({ dockLayout: 'center-stage' });
    } else if (settings.dockLayout === 'center-stage') {
      patch({ dockLayout: 'hand-stack' });
    }
  };

  const seg = <T extends string>(
    options: Array<[T, string]>,
    value: T,
    onPick: (v: T) => void,
    label: string
  ) => (
    <div
      // 4+ options don't fit one phone row — let them flow 2-up.
      className={`${styles.seg} ${options.length > 3 ? styles.segWrap : ''}`}
      role="radiogroup"
      aria-label={label}
    >
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          className={`${styles.segBtn} ${value === v ? styles.segOn : ''}`}
          onClick={() => onPick(v)}
        >
          {text}
        </button>
      ))}
    </div>
  );

  return (
    <div className={styles.wrap}>
      <div className={styles.eyebrow}>Settings</div>
      <h1 className={styles.title}>Preferences</h1>

      <SettingsUICtx.Provider value={uiCtx}>
      <div className={styles.sections}>
      <Section title="Appearance">
        <Row
          title="Theme"
          hint="Card Room felt or Morning Paper editorial, light or dark."
        >
          {seg<ThemeFamily>(
            [
              ['paper', 'Morning Paper'],
              ['card-room', 'Card Room'],
            ],
            settings.themeFamily,
            themeFamily => patch({ themeFamily }),
            'Theme'
          )}
        </Row>
        <Row title="Light / dark" hint="Light, dark, or follow the system.">
          {seg<Appearance>(
            [
              ['light', 'Light'],
              ['dark', 'Dark'],
              ['system', 'System'],
            ],
            settings.appearance,
            appearance => patch({ appearance }),
            'Light / dark'
          )}
        </Row>
        <Row
          title="Two-color deck"
          hint="Classic red & black suits instead of the four-color deck."
        >
          <Toggle
            label="Two-color deck"
            value={settings.twoColorDeck}
            onChange={v => patch({ twoColorDeck: v })}
          />
        </Row>
        <Row
          title="Deck skins"
          hint="Override the card design with an unlocked skin. Browse the store to pick one; earn more by leveling up."
        >
          <div className={styles.skinRow}>
            {settings.deckSkinsEnabled && (
              <button
                type="button"
                className={styles.quietAction}
                onClick={() => setSkinStoreOpen(true)}
              >
                Browse…
              </button>
            )}
            <Toggle
              label="Deck skins"
              value={settings.deckSkinsEnabled}
              onChange={v => patch({ deckSkinsEnabled: v })}
            />
          </div>
        </Row>
      </Section>

      <Section
        title="Game screen"
       
        action={
          <button
            type="button"
            className={styles.headAction}
            onClick={e => {
              // Inside the phone accordion's <summary>: don't toggle it.
              e.preventDefault();
              e.stopPropagation();
              setPreviewOpen(true);
            }}
          >
            Preview
          </button>
        }
      >
        <Row
          title="Dock layout"
          hint="Where the drawn card and action buttons sit."
        >
          {deskFamily
            ? seg<'center-stage' | 'compact'>(
                [
                  ['center-stage', 'Center stage'],
                  ['compact', 'Compact'],
                ],
                dockValue,
                pickDock,
                'Dock layout'
              )
            : seg<DockLayout>(
                (
                  ['classic', 'hand-stack', 'center-stage', 'desktop'] as const
                ).map(
                  l => [l, DOCK_LAYOUT_LABEL[l]] as [DockLayout, string]
                ),
                settings.dockLayout,
                dockLayout => patch({ dockLayout }),
                'Dock layout'
              )}
        </Row>
        <Row
          title="Line totals"
          hint="Show each row and column's running total along the board edges during play."
        >
          {/* ONE row, two keys (decision D): the column family binds
              lineRails (default off), the desk families bind
              deskLineChips (default on per the mockup). The split
              defaults predate this page; both keys persist unchanged. */}
          <Toggle
            label="Line totals"
            value={deskFamily ? settings.deskLineChips : settings.lineRails}
            onChange={v =>
              patch(deskFamily ? { deskLineChips: v } : { lineRails: v })
            }
          />
        </Row>
        {/* Not in the mockup — keeps the guided tutorial reachable on
            desktop (feature-reachability convention). */}
        <Row
          title="Replay tutorial"
          hint="Re-run the guided practice deal that walks through every move."
        >
          <button
            type="button"
            className={styles.quietAction}
            onClick={() => navigate('/tutorial')}
          >
            Replay
          </button>
        </Row>
      </Section>

      <Section title="Sound & accessibility">
        <Row title="Sound" hint="Place ticks, ♣ chime, and win / lose stings.">
          <Toggle
            label="Sound"
            value={settings.sounds}
            onChange={v => patch({ sounds: v })}
          />
        </Row>
        <Row
          title="Reduce motion"
          hint="Skip card-travel and celebration animations."
        >
          <Toggle
            label="Reduce motion"
            value={settings.reduceMotion}
            onChange={v => patch({ reduceMotion: v })}
          />
        </Row>
        <Row
          title="Color-blind assist"
          hint="Add glyphs alongside color-coded bonus categories."
        >
          <Toggle
            label="Color-blind assist"
            value={settings.colorBlindAssist}
            onChange={v => patch({ colorBlindAssist: v })}
          />
        </Row>
      </Section>

      <Section title="Identity & data">
          {isBackendConfigured() && (
            <Row
              title={phone ? 'Handle' : 'Leaderboard handle'}
              hint="Shown on the daily leaderboard."
            >
              {editingHandle || !handle ? (
                <div className={styles.handleEditor}>
                  <HandleEditor
                    heading={null}
                    note={!phone}
                    onSaved={() => setEditingHandle(false)}
                  />
                </div>
              ) : (
                <div className={styles.handleBox}>
                  <span className={styles.handleName}>{handle}</span>
                  <button
                    type="button"
                    className={styles.quietAction}
                    onClick={() => setEditingHandle(true)}
                  >
                    Edit
                  </button>
                </div>
              )}
            </Row>
          )}
          <Row
            title="Reset all progress"
            hint="Clears stats, achievements, streaks, and saved runs on this device. Can't be undone."
            danger
          >
            <button
              type="button"
              className={styles.resetBtn}
              onClick={() => setConfirmReset(true)}
            >
              Reset…
            </button>
          </Row>
      </Section>
      </div>
      </SettingsUICtx.Provider>

      {phone && (
        <Sheet
          open={infoSheet !== null}
          onClose={() => setInfoSheet(null)}
          title={infoSheet?.title}
        >
          <p className={styles.infoSheetBody}>{infoSheet?.hint}</p>
        </Sheet>
      )}

      {/* Live display sample: mini board + the picked dock arrangement,
          following the current choices — a picture of the settings, not
          of this viewport's game. */}
      <Sheet
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Preview"
      >
        <DisplayPreview />
      </Sheet>

      <SkinStore open={skinStoreOpen} onClose={() => setSkinStoreOpen(false)} />

      <p className={styles.buildId}>Build {__BUILD_ID__}</p>

      {/* Centered confirm modal — the DesktopResultDialog scrim/card
          pattern at small size (the primitive Dialog reads as the
          mobile sheet); same copy and actions as the phone confirm. */}
      {confirmReset && (
        <div
          className={styles.confirmScrim}
          onClick={e => {
            if (e.target === e.currentTarget) setConfirmReset(false);
          }}
        >
          <div
            className={styles.confirmCard}
            role="dialog"
            aria-modal="true"
            aria-label="Reset all progress?"
          >
            <h2 className={styles.confirmTitle}>Reset all progress?</h2>
            <p className={styles.confirmBody}>
              This permanently clears your stats, achievements, completed
              challenges, the current Targets-Up run, and your daily puzzle
              results and leaderboard identity on this device — so you can
              start over under a different name. It also re-arms the
              one-time explainers (tutorial callout, daily twist intros).
              Scores already submitted stay on the online leaderboard.
            </p>
            <div className={styles.confirmActions}>
              <Button variant="ghost" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  resetStats();
                  // Level-ack watermark back to unseeded — the AppLayout
                  // seeder re-snaps it to the (now level-1) derived level,
                  // so future level-ups announce themselves again.
                  resetProgression();
                  clearTargets();
                  resetDailyProgress();
                  clearTwistsSeen();
                  clearTutorialSeen();
                  setConfirmReset(false);
                  toast('Progress reset.', 'success');
                }}
              >
                Reset everything
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
