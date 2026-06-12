import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Dialog, useToast } from '../../design/primitives';
import { Settings, useSettingsStore } from './settingsStore';
import { useStatsStore } from '../progress/statsStore';
import { useTargetsStore } from '../targets/targetsStore';
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

  const patch = (p: Partial<Settings>) => settings.set(p);

  return (
    <section className={styles.wrap}>
      <header>
        <h1 className="text-title">Settings</h1>
      </header>

      <div className={styles.panel}>
        <ToggleRow
          title="Sounds"
          hint="Card and scoring sound effects (arriving with the polish pass)."
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

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all progress?"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p className="text-body">
            This permanently clears your stats, achievements, completed
            challenges, and the current Targets-Up run on this device. It
            also re-arms the one-time explainers (tutorial callout, daily
            twist intros).
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
