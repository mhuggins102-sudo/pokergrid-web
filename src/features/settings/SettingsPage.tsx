import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router';
import { Button, Sheet, useToast } from '../../design/primitives';
import { HandleEditor } from '../daily/RankPanel';
import { useHandle } from '../daily/sync/handleStore';
import { resetDailyProgress } from '../daily/sync/sync';
import { clearTwistsSeen } from '../daily/twistSeen';
import { isBackendConfigured } from '../../lib/supabaseRpc';
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
import styles from './SettingsPage.module.css';

/*
 * The ONE settings page at every tier (phase 4, plan decision D), per
 * design-refs/desktop/Settings.dc.html: three raised sections
 * (Gameplay / Presentation / Identity & data) of hairline-separated
 * rows with segmented pickers and pill toggles, plus the live display
 * preview. All rows read/write the same persisted settings store — no
 * key migrations.
 *
 * Tier-conditional rows:
 *  - Dock layout: phone/tablet offer the three phone-family layouts;
 *    desktop offers TWO — Center stage and Compact — because the
 *    desktop game dock only distinguishes center-stage vs the compact
 *    variant ('hand-stack' and 'classic' render identically there).
 *    Mapping (user directive, unchanged): Center stage writes
 *    'center-stage'; Compact writes 'hand-stack' only when coming FROM
 *    'center-stage', so a phone-side Classic choice survives desktop
 *    visits.
 *  - Line totals: ONE row binding the tier's key — phone → lineRails
 *    (the column game family reads it), tablet/desktop →
 *    deskLineChips (the desk family's chips). Both keys kept.
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
  span = false,
  open,
  onToggle,
  children,
}: {
  title: string;
  /** ≥1200px: span both columns of the sections grid (the Identity &
   *  data footer band; its rows then sit side by side). */
  span?: boolean;
  /** Phone accordion open state (controlled by the parent for single-open). */
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { phone } = useContext(SettingsUICtx);
  const ref = useRef<HTMLDetailsElement>(null);
  // Phone: when this section opens, bring its head to just under the
  // sticky nav so the revealed content is in view (others have closed, so
  // the layout above just shifted). scroll-margin-top clears the header.
  useEffect(() => {
    if (!phone || !open) return;
    const el = ref.current;
    if (!el) return;
    requestAnimationFrame(() => {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {
        /* jsdom / unsupported env */
      }
    });
  }, [phone, open]);
  if (phone) {
    return (
      <details ref={ref} className={styles.section} open={open}>
        <summary
          className={styles.sectionHead}
          onClick={e => {
            e.preventDefault();
            onToggle();
          }}
        >
          <span>{title}</span>
          <span className={styles.sectionCaret} aria-hidden="true">
            ▾
          </span>
        </summary>
        {children}
      </details>
    );
  }
  return (
    <section
      className={span ? `${styles.section} ${styles.sectionSpan}` : styles.section}
    >
      <div className={styles.sectionHead}>{title}</div>
      {children}
    </section>
  );
}

export function SettingsPage() {
  const tier = useTier();
  const settings = useSettingsStore();
  const resetStats = useStatsStore(s => s.reset);
  const clearTargets = useTargetsStore(s => s.clearProgress);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const [skinStoreOpen, setSkinStoreOpen] = useState(false);
  // Phone accordion: a single section open at a time (Gameplay leads).
  // Ignored ≥768, where every section renders expanded.
  const [openSection, setOpenSection] = useState('Gameplay');
  const sectionProps = (name: string) => ({
    open: openSection === name,
    onToggle: () => setOpenSection(cur => (cur === name ? '' : name)),
  });
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
      <Section title="Gameplay" {...sectionProps('Gameplay')}>
        <Row
          title="Dock layout"
          hint="Where the drawn card and action buttons sit."
        >
          {tier === 'desktop'
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
          {/* ONE row, two keys (decision D): phone binds lineRails
              (default off), tablet/desktop bind deskLineChips (default
              on per the mockup). The per-tier defaults predate this
              page; both keys persist unchanged. */}
          <Toggle
            label="Line totals"
            value={tier === 'phone' ? settings.lineRails : settings.deskLineChips}
            onChange={v =>
              patch(tier === 'phone' ? { lineRails: v } : { deskLineChips: v })
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

      <Section title="Presentation" {...sectionProps('Presentation')}>
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
        <Row title="Appearance" hint="Light, dark, or follow the system.">
          {seg<Appearance>(
            [
              ['light', 'Light'],
              ['dark', 'Dark'],
              ['system', 'System'],
            ],
            settings.appearance,
            appearance => patch({ appearance }),
            'Appearance'
          )}
        </Row>
        <Row title="Sound" hint="Place ticks, ♣ chime, and win / lose stings.">
          <Toggle
            label="Sound"
            value={settings.sounds}
            onChange={v => patch({ sounds: v })}
          />
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
            <Toggle
              label="Deck skins"
              value={settings.deckSkinsEnabled}
              onChange={v => patch({ deckSkinsEnabled: v })}
            />
            {settings.deckSkinsEnabled && (
              <button
                type="button"
                className={styles.quietAction}
                onClick={() => setSkinStoreOpen(true)}
              >
                Browse…
              </button>
            )}
          </div>
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
        {/* Live sample (ported from the phone page): mini board + dock
            arrangement following the current choices. Reads lineRails,
            so it previews the phone rails on desk tiers too — it is a
            picture of the setting, not of this viewport's game. */}
        <div className={styles.previewSlot}>
          <span className={styles.previewLabel}>Preview</span>
          <DisplayPreview />
        </div>
      </Section>

      <Section title="Identity & data" span {...sectionProps('Identity & data')}>
        {/* ≥1200px the band's rows sit side by side (hairline divider);
            when the handle row is absent, Reset spans the band alone. */}
        <div className={styles.bandRows}>
          {isBackendConfigured() && (
            <Row
              title="Leaderboard handle"
              hint="Shown on the daily leaderboard."
            >
              {editingHandle || !handle ? (
                <div className={styles.handleEditor}>
                  <HandleEditor
                    heading={null}
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
        </div>
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
