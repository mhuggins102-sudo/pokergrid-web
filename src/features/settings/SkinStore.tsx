import { CSSProperties, createContext, useContext, useState } from 'react';
import { Sheet } from '../../design/primitives';
import { SuitKey } from '../../design/deckSkins';
import { SKIN_CATALOG, SkinUnlock, skinName } from '../../design/skinCatalog';
import { LEVEL_XP, MAX_LEVEL } from '../../lib/xp';
import { skinFace } from '../game/components/skinFace';
import { useTier } from '../../app/useTier';
import { usePlayerLevel } from '../progress/usePlayerLevel';
import { useSettingsStore } from './settingsStore';
import styles from './SkinStore.module.css';

// Which suit every sample face renders — toggled from the store header so a
// player can preview each design in the color they play. Defaults to hearts:
// the spade sample (the old hard-coded default) is the least colorful suit,
// which made the store read as muted next to the in-game cards.
const SampleSuitCtx = createContext<SuitKey>('h');

const SUIT_ORDER: SuitKey[] = ['h', 'd', 'c', 's'];
const SUIT_GLYPH: Record<SuitKey, string> = { h: '♥', d: '♦', c: '♣', s: '♠' };
const SUIT_LABEL: Record<SuitKey, string> = {
  h: 'Hearts',
  d: 'Diamonds',
  c: 'Clubs',
  s: 'Spades',
};

// UI glyph color for the suit toggles (chrome on the dialog): the theme's
// readable-on-surface suit hues in four-color mode; red / neutral-ink in
// two-color mode.
const suitToggleColor = (k: SuitKey, twoColor: boolean): string =>
  twoColor
    ? k === 'h' || k === 'd'
      ? 'var(--card-red)'
      : 'var(--ink)'
    : `var(--suit-${k})`;

// On-card ink color for the plain "Theme default" sample (its face is always
// paper-light, so it uses the on-face suit variants / red-black).
const faceSuitColor = (k: SuitKey, four: boolean): string =>
  four
    ? `var(--face-suit-${k})`
    : k === 'h' || k === 'd'
      ? 'var(--card-red)'
      : 'var(--card-black)';

// A mini preview of a skin's real card face (Claude Design's token
// renderer) — a fixed-size square so the container-query units resolve.
// The suit comes from the header toggle (context); `className`/`style` let
// callers layer extra styling on the wrap.
function SkinPreview({
  id,
  size = 58,
  className,
  style,
}: {
  id: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const four = !useSettingsStore(s => s.twoColorDeck);
  const suit = useContext(SampleSuitCtx);
  // Preview the layout this device actually renders in-game (phone → mobile).
  const mobile = useTier() === 'phone';
  const face = skinFace(id, 'A', suit, four, mobile);
  return (
    <span
      className={className ? `${styles.preview} ${className}` : styles.preview}
      style={{ ...face.wrap, width: size, height: size, ...style }}
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

const LOCK_PATH =
  'M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z';

// A large copy of a face, centered a layer above the sheet (position:fixed
// via .magFloat). Two triggers: on hover-capable pointers it appears while
// the row is hovered (desktop, CSS-driven); `shown` force-shows it for the
// tap-to-inspect overlay (touch, where there is no hover). Locked entries
// magnify their dimmed, padlocked cover.
function Magnify({
  id,
  locked = false,
  shown = false,
}: {
  id: string;
  locked?: boolean;
  shown?: boolean;
}) {
  return (
    <span
      className={`${styles.magFloat}${locked ? ` ${styles.magFloatLocked}` : ''}${
        shown ? ` ${styles.magShown}` : ''
      }`}
      aria-hidden="true"
    >
      <SkinPreview
        id={id}
        size={208}
        className={locked ? styles.magPreviewLocked : undefined}
      />
      {locked && (
        <span className={styles.magLock}>
          <svg viewBox="0 0 24 24" width="64" height="64" fill="currentColor">
            <path d={LOCK_PATH} />
          </svg>
        </span>
      )}
    </span>
  );
}

function SkinTile({
  id,
  selected,
  onSelect,
}: {
  id: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.tile} ${selected ? styles.tileSelected : ''}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <SkinPreview id={id} />
      <span className={styles.tileName}>{skinName(id)}</span>
      {selected && <span className={styles.tileCheck} aria-hidden="true">✓</span>}
      <Magnify id={id} />
    </button>
  );
}

// Locked entry — cover preview dimmed under a padlock + required level.
// The card IMAGE enlarges (hover on desktop, tap on touch → onEnlarge);
// tapping the rest of the row previews its required level in the header
// (onInspect). Two separate targets, per the row-vs-image split.
function LockedEntry({
  unlock,
  onInspect,
  onEnlarge,
}: {
  unlock: SkinUnlock;
  onInspect: () => void;
  onEnlarge: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.entry} ${styles.entryLocked}`}
      onClick={onInspect}
      aria-label={`${unlock.name} — locked, reach level ${unlock.level}`}
    >
      <span
        className={styles.coverWrap}
        aria-hidden="true"
        onClick={e => {
          // The image is its own target: enlarge, don't fall through to the
          // row's level-preview.
          e.stopPropagation();
          onEnlarge();
        }}
      >
        <SkinPreview id={unlock.skinIds[0]} />
        <span className={styles.lock}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d={LOCK_PATH} />
          </svg>
        </span>
      </span>
      <div className={styles.entryMeta}>
        <span className={styles.entryName}>{unlock.name}</span>
        <span className={styles.entryLevel}>
          Reach Level {unlock.level}
          {unlock.skinIds.length > 1 ? ` · ${unlock.skinIds.length} designs` : ''}
        </span>
      </div>
      <Magnify id={unlock.skinIds[0]} locked />
    </button>
  );
}

// Unlocked entry: a single tile, or a group that expands to its variants.
function UnlockedEntry({
  unlock,
  selected,
  onSelect,
}: {
  unlock: SkinUnlock;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  if (unlock.skinIds.length === 1) {
    const id = unlock.skinIds[0];
    return (
      <SkinTile id={id} selected={selected === id} onSelect={() => onSelect(id)} />
    );
  }
  const anySelected = unlock.skinIds.includes(selected ?? '');
  return (
    <details className={styles.group} open={anySelected}>
      {/* Collapsed head: same-size preview as a single tile (so the row
          matches). Hovering it magnifies the cover; the variants inside
          magnify individually. */}
      <summary className={styles.groupHead}>
        <SkinPreview id={unlock.skinIds[0]} />
        <span className={styles.groupMeta}>
          <span className={styles.entryName}>{unlock.name}</span>
          <span className={styles.entryLevel}>
            {unlock.skinIds.length} designs · tap to choose
          </span>
        </span>
        <span className={styles.groupCaret} aria-hidden="true">▾</span>
        <Magnify id={unlock.skinIds[0]} />
      </summary>
      <div className={styles.groupGrid}>
        {unlock.skinIds.map(id => (
          <SkinTile
            key={id}
            id={id}
            selected={selected === id}
            onSelect={() => onSelect(id)}
          />
        ))}
      </div>
    </details>
  );
}

/**
 * The deck-skin "store": Claude Design's card faces, gated by player level.
 * Locked entries show a padlock + the level they unlock at; unlocked ones
 * are tappable (groups expand to their variants). Selecting sets `deckSkin`.
 * The header's suit toggles recolor every sample face.
 */
export function SkinStore({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { level, xp, atMax, xpIntoLevel, levelSpan, progress } = usePlayerLevel();
  const selected = useSettingsStore(s => s.deckSkin);
  const twoColor = useSettingsStore(s => s.twoColorDeck);
  const set = useSettingsStore(s => s.set);
  const [sampleSuit, setSampleSuit] = useState<SuitKey>('h');
  // Tapping a locked row previews its required level in the header (total XP
  // earned / XP to reach it). Tapping its card image instead enlarges the
  // padlocked cover a layer above the sheet (the touch path to the desktop
  // hover magnifier), dismissed by tapping the backdrop.
  const [inspect, setInspect] = useState<SkinUnlock | null>(null);
  const [enlarge, setEnlarge] = useState<SkinUnlock | null>(null);

  // Header shows the real level normally; while inspecting a locked entry it
  // previews that level as cumulative progress toward unlocking it.
  const inspectLevel = inspect?.level ?? null;
  const inspectNeed =
    inspectLevel !== null ? LEVEL_XP[Math.min(inspectLevel, MAX_LEVEL) - 1] : 0;
  const headLevel = inspectLevel ?? level;
  const headXp =
    inspectLevel !== null
      ? `${xp} / ${inspectNeed} XP`
      : atMax
        ? 'Max level'
        : `${xpIntoLevel} / ${levelSpan} XP to next`;
  const headProgress =
    inspectLevel !== null
      ? inspectNeed > 0
        ? Math.min(1, xp / inspectNeed)
        : 1
      : progress;

  const close = () => {
    setInspect(null);
    setEnlarge(null);
    onClose();
  };
  // Picking a skin (or the theme default) clears a stale locked-level
  // preview so the header snaps back to the real level.
  const pick = (id: string | null) => {
    setInspect(null);
    set({ deckSkin: id });
  };

  const title = (
    <span className={styles.titleRow}>
      <span>Deck skins</span>
      <span className={styles.suitToggles} role="group" aria-label="Preview suit">
        {SUIT_ORDER.map(k => (
          <button
            key={k}
            type="button"
            className={`${styles.suitBtn} ${sampleSuit === k ? styles.suitOn : ''}`}
            style={{ color: suitToggleColor(k, twoColor) }}
            aria-pressed={sampleSuit === k}
            aria-label={SUIT_LABEL[k]}
            onClick={() => setSampleSuit(k)}
          >
            {SUIT_GLYPH[k]}
          </button>
        ))}
      </span>
    </span>
  );

  return (
    <Sheet open={open} onClose={close} title={title}>
      <SampleSuitCtx.Provider value={sampleSuit}>
        <div
          className={`${styles.head} ${inspect ? styles.headInspect : ''}`}
        >
          <div className={styles.levelRow}>
            <span className={styles.levelBadge}>Level {headLevel}</span>
            <span className={styles.levelXp}>{headXp}</span>
          </div>
          <div className={styles.track}>
            <div
              className={styles.fill}
              style={{ width: `${Math.round(headProgress * 100)}%` }}
            />
          </div>
        </div>

        <div className={styles.list}>
          {/* Theme default (always available) — clears the override. */}
          <button
            type="button"
            className={`${styles.tile} ${selected === null ? styles.tileSelected : ''}`}
            aria-pressed={selected === null}
            onClick={() => pick(null)}
          >
            <span className={styles.defaultPreview} aria-hidden="true">
              <span
                className={styles.defRank}
                style={{ color: faceSuitColor(sampleSuit, !twoColor) }}
              >
                A
              </span>
              <span
                className={styles.defPip}
                style={{ color: faceSuitColor(sampleSuit, !twoColor) }}
              >
                {SUIT_GLYPH[sampleSuit]}
              </span>
            </span>
            <span className={styles.tileName}>Theme default</span>
            {selected === null && (
              <span className={styles.tileCheck} aria-hidden="true">✓</span>
            )}
          </button>

          {SKIN_CATALOG.map(unlock =>
            level >= unlock.level ? (
              <UnlockedEntry
                key={unlock.id}
                unlock={unlock}
                selected={selected}
                onSelect={pick}
              />
            ) : (
              <LockedEntry
                key={unlock.id}
                unlock={unlock}
                onInspect={() => setInspect(unlock)}
                onEnlarge={() => setEnlarge(unlock)}
              />
            )
          )}
        </div>

        {/* Tap-to-enlarge overlay: the padlocked cover a layer above the
            sheet, with a backdrop that dismisses on tap. The touch path to
            the same enlargement desktop gets on hovering the image. */}
        {enlarge && (
          <div
            className={styles.inspectBackdrop}
            onClick={() => setEnlarge(null)}
          >
            <Magnify id={enlarge.skinIds[0]} locked shown />
          </div>
        )}
      </SampleSuitCtx.Provider>
    </Sheet>
  );
}
