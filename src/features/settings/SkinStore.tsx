import { Sheet } from '../../design/primitives';
import { DeckSkin, SKIN_CATALOG, SkinUnlock } from '../../design/deckSkins';
import { usePlayerLevel } from '../progress/usePlayerLevel';
import { useSettingsStore } from './settingsStore';
import styles from './SkinStore.module.css';

// A mini card preview painted with a skin's placeholder face (real art
// will render as a full image here). A sample rank + pip sits on top so
// the swatch reads as a card.
function SkinSwatch({ skin }: { skin: DeckSkin }) {
  return (
    <span
      className={styles.swatch}
      style={{ background: skin.face, color: skin.ink ?? 'var(--card-black)' }}
      aria-hidden="true"
    >
      <span className={styles.swatchRank}>A</span>
      <span className={styles.swatchPip}>♠</span>
    </span>
  );
}

function SkinTile({
  skin,
  selected,
  onSelect,
}: {
  skin: DeckSkin;
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
      <SkinSwatch skin={skin} />
      <span className={styles.tileName}>{skin.name}</span>
      {selected && <span className={styles.tileCheck} aria-hidden="true">✓</span>}
    </button>
  );
}

// A locked unlock entry: its cover art is dimmed under a lock silhouette
// with the level it unlocks at.
function LockedEntry({ unlock }: { unlock: SkinUnlock }) {
  return (
    <div className={`${styles.entry} ${styles.entryLocked}`}>
      <span
        className={styles.cover}
        style={{ background: unlock.skins[0].face }}
        aria-hidden="true"
      >
        <span className={styles.lock} aria-hidden="true">
          {/* padlock silhouette */}
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z" />
          </svg>
        </span>
      </span>
      <div className={styles.entryMeta}>
        <span className={styles.entryName}>{unlock.name}</span>
        <span className={styles.entryLevel}>
          Reach Level {unlock.level}
          {unlock.skins.length > 1 ? ` · ${unlock.skins.length} designs` : ''}
        </span>
      </div>
    </div>
  );
}

// An unlocked single-skin entry (one tile) or group entry (an expandable
// details listing every variant, all usable).
function UnlockedEntry({
  unlock,
  selected,
  onSelect,
}: {
  unlock: SkinUnlock;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  if (unlock.skins.length === 1) {
    const skin = unlock.skins[0];
    return (
      <SkinTile
        skin={skin}
        selected={selected === skin.id}
        onSelect={() => onSelect(skin.id)}
      />
    );
  }
  const anySelected = unlock.skins.some(s => s.id === selected);
  return (
    <details className={styles.group} open={anySelected}>
      <summary className={styles.groupHead}>
        <span
          className={styles.groupCover}
          style={{ background: unlock.skins[0].face }}
          aria-hidden="true"
        />
        <span className={styles.groupMeta}>
          <span className={styles.entryName}>{unlock.name}</span>
          <span className={styles.entryLevel}>
            {unlock.skins.length} designs · tap to choose
          </span>
        </span>
        <span className={styles.groupCaret} aria-hidden="true">▾</span>
      </summary>
      <div className={styles.groupGrid}>
        {unlock.skins.map(skin => (
          <SkinTile
            key={skin.id}
            skin={skin}
            selected={selected === skin.id}
            onSelect={() => onSelect(skin.id)}
          />
        ))}
      </div>
    </details>
  );
}

/**
 * The deck-skin "store": a scrollable catalog of unlockable card-face
 * designs gated by player level. Locked entries show a padlock + the level
 * they unlock at; unlocked ones are tappable (groups expand to their
 * variants). Selecting one sets `deckSkin`.
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
            {atMax
              ? 'Max level'
              : `${xpIntoLevel} / ${levelSpan} XP to next`}
          </span>
        </div>
        <div className={styles.track}>
          <div
            className={styles.fill}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>

      <div className={styles.list}>
        {/* Theme default (always available) — clears any override. */}
        <button
          type="button"
          className={`${styles.tile} ${styles.defaultTile} ${
            selected === null ? styles.tileSelected : ''
          }`}
          aria-pressed={selected === null}
          onClick={() => set({ deckSkin: null })}
        >
          <span className={styles.defaultSwatch} aria-hidden="true">
            <span className={styles.swatchRank}>A</span>
            <span className={styles.swatchPip}>♠</span>
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
