import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Dialog, Sheet, useToast } from '../../design/primitives';
import { DOCK_LAYOUT_LABEL, DockLayoutPreview } from './DockLayoutPreview';
import {
  DockLayout,
  Settings,
  ThemeChoice,
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

export function SettingsPage() {
  const settings = useSettingsStore();
  const resetStats = useStatsStore(s => s.reset);
  const clearTargets = useTargetsStore(s => s.clearProgress);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  // Preview sheet for the just-picked dock layout.
  const [previewLayout, setPreviewLayout] = useState<DockLayout | null>(null);

  const patch = (p: Partial<Settings>) => settings.set(p);

  const pickDock = (layout: DockLayout) => {
    patch({ dockLayout: layout });
    setPreviewLayout(layout);
  };

  return (
    <section className={styles.wrap}>
      <header>
        <h1 className="text-title">Settings</h1>
      </header>

      <div className={styles.panel}>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Theme</span>
            <span className={styles.rowHint}>
              Card Room is the refreshed look (System follows your
              device&apos;s light/dark preference). Morning Paper is the
              original.
            </span>
          </div>
        </div>
        <div className={styles.segmented} role="radiogroup" aria-label="Theme">
          {(
            [
              ['system', 'System'],
              ['card-room', 'Card Room'],
              ['card-room-dark', 'Dark'],
              ['paper', 'Morning Paper'],
            ] as [ThemeChoice, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={settings.theme === value}
              className={`${styles.segment} ${
                settings.theme === value ? styles.segmentOn : ''
              }`}
              onClick={() => patch({ theme: value })}
            >
              {label}
            </button>
          ))}
        </div>
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
        <ToggleRow
          title="Two-color deck"
          hint="Classic red/black faces; off gives each suit its own color."
          value={settings.twoColorDeck}
          onChange={v => patch({ twoColorDeck: v })}
        />
        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Game controls</span>
            <span className={styles.rowHint}>
              How the drawn card and action buttons arrange under the board.
            </span>
          </div>
        </div>
        <div
          className={styles.segmented}
          role="radiogroup"
          aria-label="Game controls layout"
        >
          {(['classic', 'hand-stack', 'center-stage'] as DockLayout[]).map(
            l => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={settings.dockLayout === l}
                className={`${styles.segment} ${
                  settings.dockLayout === l ? styles.segmentOn : ''
                }`}
                onClick={() => pickDock(l)}
              >
                {DOCK_LAYOUT_LABEL[l]}
              </button>
            )
          )}
        </div>
      </div>

      <div className={styles.panel}>
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
      </div>

      <div className={styles.panel}>
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
      </div>

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

      <Sheet
        open={previewLayout !== null}
        onClose={() => setPreviewLayout(null)}
        title={previewLayout ? DOCK_LAYOUT_LABEL[previewLayout] : ''}
      >
        {previewLayout && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <DockLayoutPreview layout={previewLayout} />
            <p className="text-label" style={{ color: 'var(--ink-3)' }}>
              Applied — your next game uses this arrangement.
            </p>
          </div>
        )}
      </Sheet>

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
