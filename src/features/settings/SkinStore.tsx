import { Sheet } from '../../design/primitives';
import { SKINS } from '../../design/deckSkins';
import { SKIN_CATALOG, SkinUnlock, skinName } from '../../design/skinCatalog';
import { skinFace } from '../game/components/skinFace';
import { usePlayerLevel } from '../progress/usePlayerLevel';
import { useSettingsStore } from './settingsStore';
import styles from './SkinStore.module.css';

// A mini preview of a skin's real card face (Claude Design's token
// renderer) — a fixed-size square so the container-query units resolve.
function SkinPreview({ id, size = 58 }: { id: string; size?: number }) {
  const four = !useSettingsStore(s => s.twoColorDeck);
  const face = skinFace(id, 'A', 's', four);
  return (
    <span
      className={styles.preview}
      style={{ ...face.wrap, width: size, height: size }}
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
    </button>
  );
}

// Locked entry — cover preview dimmed under a padlock + required level.
function LockedEntry({ unlock }: { unlock: SkinUnlock }) {
  return (
    <div className={`${styles.entry} ${styles.entryLocked}`}>
      <span className={styles.coverWrap} aria-hidden="true">
        <SkinPreview id={unlock.skinIds[0]} size={54} />
        <span className={styles.lock}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z" />
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
    </div>
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
      <summary className={styles.groupHead}>
        <SkinPreview id={unlock.skinIds[0]} size={40} />
        <span className={styles.groupMeta}>
          <span className={styles.entryName}>{unlock.name}</span>
          <span className={styles.entryLevel}>
            {unlock.skinIds.length} designs · tap to choose
          </span>
        </span>
        <span className={styles.groupCaret} aria-hidden="true">▾</span>
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
 */
export function SkinStore({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { level, atMax, xpIntoLevel, levelSpan, progress } = usePlayerLevel();
  const selected = useSettingsStore(s => s.deckSkin);
  const set = useSettingsStore(s => s.set);

  return (
    <Sheet open={open} onClose={onClose} title="Deck skins">
      <div className={styles.head}>
        <div className={styles.levelRow}>
          <span className={styles.levelBadge}>Level {level}</span>
          <span className={styles.levelXp}>
            {atMax ? 'Max level' : `${xpIntoLevel} / ${levelSpan} XP to next`}
          </span>
        </div>
        <div className={styles.track}>
          <div
            className={styles.fill}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <span className={styles.count}>
          {SKINS.length} designs · {SKIN_CATALOG.length} unlocks
        </span>
      </div>

      <div className={styles.list}>
        {/* Theme default (always available) — clears the override. */}
        <button
          type="button"
          className={`${styles.tile} ${selected === null ? styles.tileSelected : ''}`}
          aria-pressed={selected === null}
          onClick={() => set({ deckSkin: null })}
        >
          <span className={styles.defaultPreview} aria-hidden="true">
            <span className={styles.defRank}>A</span>
            <span className={styles.defPip}>♠</span>
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
              onSelect={id => set({ deckSkin: id })}
            />
          ) : (
            <LockedEntry key={unlock.id} unlock={unlock} />
          )
        )}
      </div>
    </Sheet>
  );
}
