import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Chevron, Dialog, useToast } from '../../design/primitives';
import { DOCK_LAYOUT_LABEL } from './DockLayoutPreview';
import { DisplayPreview } from './DisplayPreview';
import {
  Appearance,
  DockLayout,
  Settings,
  ThemeFamily,
  useSettingsStore,
} from './settingsStore';
import { useStatsStore } from '../progress/statsStore';
import { useTargetsStore } from '../targets/targetsStore';
import { resetDailyProgress } from '../daily/sync/sync';
import { clearTwistsSeen } from '../daily/twistSeen';
import { clearTutorialSeen } from '../tutorial/tutorialSeen';
import styles from './SettingsPage.module.css';

function ToggleRow({
  title,
  hint,
  value,
  onChange,
}: {
  title: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        <span className={styles.rowHint}>{hint}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={title}
        className={`${styles.toggle} ${value ? styles.toggleOn : ''}`}
        onClick={() => onChange(!value)}
      />
    </div>
  );
}

// A labeled radio-segment picker; generic over the option value type.
function SegmentedRow<T extends string>({
  title,
  hint,
  options,
  value,
  onChange,
}: {
  title: string;
  hint?: string;
  options: readonly [T, string][];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <>
      <div className={`${styles.row} ${styles.segmentedHead}`}>
        <div className={styles.rowText}>
          <span className={styles.rowTitle}>{title}</span>
          {hint && <span className={styles.rowHint}>{hint}</span>}
        </div>
      </div>
      <div className={styles.segmented} role="radiogroup" aria-label={title}>
        {options.map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            className={`${styles.segment} ${value === v ? styles.segmentOn : ''}`}
            onClick={() => onChange(v)}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );
}

// Accordion section: styled native <details>, so open/close state and
// keyboard behavior come free.
function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className={styles.section} open={defaultOpen}>
      <summary className={styles.sectionSummary}>
        {title}
        <Chevron direction="right" size={18} className={styles.sectionCaret} />
      </summary>
      <div className={styles.sectionBody}>{children}</div>
    </details>
  );
}

export function SettingsPage() {
  const settings = useSettingsStore();
  const resetStats = useStatsStore(s => s.reset);
  const clearTargets = useTargetsStore(s => s.clearProgress);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [confirmReset, setConfirmReset] = useState(false);

  const patch = (p: Partial<Settings>) => settings.set(p);

  return (
    <section className={styles.wrap}>
      <header>
        <h1 className="text-title">Settings</h1>
      </header>

      <Section title="Display" defaultOpen>
        <SegmentedRow<ThemeFamily>
          title="Theme"
          hint="Card Room is the refreshed table look; Morning Paper is the original editorial style."
          options={[
            ['card-room', 'Card Room'],
            ['paper', 'Morning Paper'],
          ]}
          value={settings.themeFamily}
          onChange={themeFamily => patch({ themeFamily })}
        />
        <SegmentedRow<Appearance>
          title="Appearance"
          hint="System follows your device's light/dark preference."
          options={[
            ['light', 'Light'],
            ['dark', 'Dark'],
            ['system', 'System'],
          ]}
          value={settings.appearance}
          onChange={appearance => patch({ appearance })}
        />
        <ToggleRow
          title="Line rails"
          hint="Show each row and column's running total along the board edges."
          value={settings.lineRails}
          onChange={v => patch({ lineRails: v })}
        />
        <ToggleRow
          title="Two-color deck"
          hint="Classic red/black faces; off gives each suit its own color."
          value={settings.twoColorDeck}
          onChange={v => patch({ twoColorDeck: v })}
        />
        <SegmentedRow<DockLayout>
          title="Dock"
          hint="How the drawn card and action buttons arrange under the board."
          options={(['classic', 'hand-stack', 'center-stage'] as const).map(
            l => [l, DOCK_LAYOUT_LABEL[l]] as [DockLayout, string]
          )}
          value={settings.dockLayout}
          onChange={dockLayout => patch({ dockLayout })}
        />
        <div className={styles.previewSlot}>
          <span className={styles.previewLabel}>Preview</span>
          <DisplayPreview />
        </div>
      </Section>

      <Section title="Preferences">
        <ToggleRow
          title="Sounds"
          hint="Card and scoring sound effects."
          value={settings.sounds}
          onChange={v => patch({ sounds: v })}
        />
        <ToggleRow
          title="Reduce motion"
          hint="Minimize card-travel and dialog animations."
          value={settings.reduceMotion}
          onChange={v => patch({ reduceMotion: v })}
        />
        <ToggleRow
          title="Color-blind assist"
          hint="Add glyphs alongside color-coded bonus categories."
          value={settings.colorBlindAssist}
          onChange={v => patch({ colorBlindAssist: v })}
        />
      </Section>

      <Section title="More">
        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Replay tutorial</span>
            <span className={styles.rowHint}>
              Re-run the guided practice deal that walks through every move.
            </span>
          </div>
          <Button size="sm" onClick={() => navigate('/tutorial')}>
            Replay
          </Button>
        </div>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={`${styles.rowTitle} ${styles.danger}`}>
              Reset all progress
            </span>
            <span className={styles.rowHint}>
              Wipes stats, achievements, challenge completion, and the
              Targets-Up run.
            </span>
          </div>
          <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>
            Reset
          </Button>
        </div>
      </Section>

      <p
        style={{
          fontSize: 12,
          color: 'var(--ink-3)',
          textAlign: 'center',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        Build {__BUILD_ID__}
      </p>

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all progress?"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p className="text-body">
            This permanently clears your stats, achievements, completed
            challenges, the current Targets-Up run, and your daily puzzle
            results and leaderboard identity on this device — so you can
            start over under a different name. It also re-arms the one-time
            explainers (tutorial callout, daily twist intros). Scores
            already submitted stay on the online leaderboard.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
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
      </Dialog>
    </section>
  );
}
