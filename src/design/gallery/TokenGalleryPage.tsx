import { useState } from 'react';
import {
  colors,
  difficultyColors,
  radius,
  shadows,
  spacing,
} from '../tokens';
import { Button, Dialog, Sheet, Tabs, useToast } from '../primitives';
import styles from './TokenGalleryPage.module.css';

function SwatchGrid({ entries }: { entries: Record<string, string> }) {
  return (
    <div className={styles.swatches}>
      {Object.entries(entries).map(([name, value]) => (
        <div key={name} className={styles.swatch}>
          <div className={styles.swatchChip} style={{ background: value }} />
          <span className={styles.swatchName}>{name}</span>
          <span className={styles.swatchValue}>{value}</span>
        </div>
      ))}
    </div>
  );
}

const SUIT_CHIPS: Array<{ glyph: string; color: string; name: string }> = [
  { glyph: '♥', color: colors.suitH, name: 'hearts' },
  { glyph: '♦', color: colors.suitD, name: 'diamonds' },
  { glyph: '♣', color: colors.suitC, name: 'clubs' },
  { glyph: '♠', color: colors.suitS, name: 'spades' },
  { glyph: '🃏', color: colors.joker, name: 'joker' },
];

/**
 * Development reference page (/design): renders every token and primitive
 * so a deploy preview shows the whole system at a glance. Also doubles as
 * the Phase 1 "preview renders a token-gallery page" verification target.
 */
export function TokenGalleryPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState('aces');
  const { toast } = useToast();

  return (
    <div className={styles.wrap}>
      <header>
        <h1 className="text-hero">Morning Paper</h1>
        <p className="text-body" style={{ color: 'var(--ink-2)' }}>
          PokerGrid editorial design tokens &amp; primitives.
        </p>
      </header>

      <section className={styles.section}>
        <h2 className="text-section">Type roles</h2>
        <p className="text-hero">Hero 44 — Fraunces</p>
        <p className="text-title">Title 28 — Fraunces</p>
        <p className="text-section">Section 13 — Inter caps</p>
        <p className="text-body">
          Body 16 — Inter. Place 25 cards into a 5×5 grid; every row and
          column scores as a poker hand.
        </p>
        <p className="text-label">Label 13 — Inter medium</p>
        <p className="text-value">Value 20 — 1,234,567 (tabular)</p>
        <p className="text-rank">Rank 24 — #42 of 1,337</p>
        <p className="text-rank-sub">Rank sub 13 — top 3.1%</p>
      </section>

      <section className={styles.section}>
        <h2 className="text-section">Surfaces &amp; ink</h2>
        <SwatchGrid
          entries={{
            paper: colors.paper,
            'paper-raised': colors.paperRaised,
            'paper-sunken': colors.paperSunken,
            felt: colors.felt,
            ink: colors.ink,
            'ink-2': colors.ink2,
            'ink-3': colors.ink3,
            rule: colors.rule,
          }}
        />
      </section>

      <section className={styles.section}>
        <h2 className="text-section">Signals &amp; difficulty</h2>
        <SwatchGrid
          entries={{
            accent: colors.accent,
            warn: colors.warn,
            danger: colors.danger,
            success: colors.success,
            easy: difficultyColors.easy,
            medium: difficultyColors.medium,
            hard: difficultyColors.hard,
            extreme: difficultyColors.extreme,
          }}
        />
      </section>

      <section className={styles.section}>
        <h2 className="text-section">Card faces &amp; suit chips</h2>
        <div className={styles.cardRow}>
          <div className={styles.miniCard} style={{ color: colors.cardRed }}>
            <span>A♥</span>
            <span className={styles.miniCardBottom}>A♥</span>
          </div>
          <div className={styles.miniCard} style={{ color: colors.cardBlack }}>
            <span>K♠</span>
            <span className={styles.miniCardBottom}>K♠</span>
          </div>
          <div className={`${styles.miniCard} ${styles.miniCardBack}`} />
        </div>
        <div className={styles.row}>
          {SUIT_CHIPS.map(s => (
            <span
              key={s.name}
              className="text-value"
              style={{ color: s.color }}
              title={s.name}
            >
              {s.glyph}
            </span>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className="text-section">Spacing</h2>
        {Object.entries(spacing).map(([name, px]) => (
          <div key={name} className={styles.row}>
            <span className="text-label" style={{ width: 48 }}>
              {name}
            </span>
            <div className={styles.spacingBar} style={{ width: px * 4 }} />
            <span className="text-label">{px}px</span>
          </div>
        ))}
      </section>

      <section className={styles.section}>
        <h2 className="text-section">Radius &amp; shadows</h2>
        <div className={styles.row}>
          {Object.entries(radius).map(([name, px]) => (
            <div key={name} className={styles.swatch}>
              <div
                className={styles.radiusBox}
                style={{ borderRadius: px }}
              />
              <span className={styles.swatchName}>
                {name} · {px}px
              </span>
            </div>
          ))}
        </div>
        <div className={styles.row}>
          {Object.entries(shadows).map(([name, shadow]) => (
            <div
              key={name}
              className={styles.shadowBox}
              style={{ boxShadow: shadow }}
            >
              shadow-{name}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className="text-section">Felt accent surface</h2>
        <div className={styles.felt}>
          <span className={`text-label ${styles.labelOnFelt}`}>
            Board accent — used sparingly.
          </span>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className="text-section">Buttons</h2>
        <div className={styles.row}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
        <div className={styles.row}>
          <Button variant="primary" size="sm">
            Small
          </Button>
          <Button variant="primary">Medium</Button>
          <Button variant="primary" size="lg">
            Large
          </Button>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className="text-section">Overlays &amp; feedback</h2>
        <div className={styles.row}>
          <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
          <Button onClick={() => setSheetOpen(true)}>Open sheet</Button>
          <Button onClick={() => toast('Saved to the archive.')}>
            Neutral toast
          </Button>
          <Button onClick={() => toast('Score submitted.', 'success')}>
            Success toast
          </Button>
          <Button onClick={() => toast('Could not reach the server.', 'danger')}>
            Danger toast
          </Button>
        </div>
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Native dialog"
        >
          <p className="text-body">
            Built on the platform&apos;s <code>&lt;dialog&gt;</code> — focus
            trap, Escape, and backdrop come free.
          </p>
        </Dialog>
        <Sheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Bottom sheet"
        >
          <p className="text-body">
            Sheet on small screens, centered dialog from 640px up.
          </p>
        </Sheet>
      </section>

      <section className={styles.section}>
        <h2 className="text-section">Tabs</h2>
        <Tabs
          label="Example tabs"
          value={tab}
          onChange={setTab}
          tabs={[
            {
              id: 'aces',
              label: 'Aces',
              content: <p className="text-body">Content for the Aces tab.</p>,
            },
            {
              id: 'faces',
              label: 'Faces',
              content: <p className="text-body">Content for the Faces tab.</p>,
            },
            {
              id: 'pips',
              label: 'Pips',
              content: <p className="text-body">Content for the Pips tab.</p>,
            },
          ]}
        />
      </section>
    </div>
  );
}
