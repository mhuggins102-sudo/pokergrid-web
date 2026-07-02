// Tiny WebAudio synth — no audio assets. Soft, papery sounds in keeping
// with the editorial feel. Callers gate on the sounds setting; this
// module only owns synthesis.

let ctx: AudioContext | null = null;

const audio = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
};

const tone = (
  freq: number,
  startIn: number,
  duration: number,
  peak: number,
  type: OscillatorType = 'sine',
  /** Optional frequency glide target — for slides/whooshes. */
  glideTo?: number
): void => {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + startIn;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo !== undefined) {
    osc.frequency.linearRampToValueAtTime(glideTo, t0 + duration);
  }
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
};

/** Card placed — a felt-damped tick. */
export const sfxPlace = (): void => {
  tone(660, 0, 0.07, 0.08, 'triangle');
  tone(330, 0, 0.09, 0.05, 'sine');
};

/** ♣ draw opens / bonus card kept — a small two-note chime. */
export const sfxChime = (): void => {
  tone(523.25, 0, 0.12, 0.06);
  tone(783.99, 0.07, 0.16, 0.05);
};

/** ♥ swap / Power Swap / Jump — two voices trading places. */
export const sfxSwap = (): void => {
  tone(440, 0, 0.09, 0.06, 'triangle', 587.33);
  tone(587.33, 0.07, 0.1, 0.06, 'triangle', 440);
};

/** ♠ slide / Slip & Slide — a felt glide upward. */
export const sfxSlide = (): void => {
  tone(220, 0, 0.18, 0.06, 'sine', 392);
  tone(440, 0.04, 0.14, 0.03, 'triangle', 660);
};

/** ♦ destroy / Mega Destroy — a short low thump. */
export const sfxDestroy = (): void => {
  tone(180, 0, 0.12, 0.09, 'square', 70);
  tone(90, 0.02, 0.16, 0.06, 'sine', 50);
};

/** Doubler / Wildcard / Plus-Minus — an enchantment sparkle. */
export const sfxEnchant = (): void => {
  [880, 1108.73, 1318.51].forEach((f, i) => tone(f, i * 0.05, 0.1, 0.045));
};

/** Shuffle / Rewind — a quick card riffle. */
export const sfxRiffle = (): void => {
  for (let i = 0; i < 5; i++) {
    tone(500 + i * 90, i * 0.035, 0.04, 0.045, 'triangle');
  }
};

/** Revive — a soft rise from the discard pile. */
export const sfxRevive = (): void => {
  tone(392, 0, 0.16, 0.05, 'sine', 523.25);
  tone(659.25, 0.12, 0.18, 0.05);
};

/**
 * Joker auto-placed — a springy bend with a sparkle on top. Starts
 * ~0.4s late by design: the joker's pop-in animation on the board is
 * delayed the same amount, so the flourish lands with the card.
 */
export const sfxJoker = (): void => {
  tone(330, 0.4, 0.16, 0.07, 'triangle', 660);
  tone(880, 0.52, 0.1, 0.05);
  tone(1108.73, 0.58, 0.14, 0.045);
};

/** Double Duty flip — a rotational whoosh down and back up (the 180°),
 *  with a low papery tick as the burned card leaves the deck. */
export const sfxFlip = (): void => {
  tone(520, 0, 0.09, 0.05, 'triangle', 260);
  tone(260, 0.07, 0.11, 0.06, 'triangle', 520);
  tone(200, 0.2, 0.05, 0.035, 'square', 150);
};

/** Target beaten — rising arpeggio. */
export const sfxWin = (): void => {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    tone(f, i * 0.09, 0.22, 0.07)
  );
};

/** Target missed — two soft descending notes. */
export const sfxLose = (): void => {
  tone(392, 0, 0.2, 0.06);
  tone(311.13, 0.12, 0.28, 0.05);
};

// A single short peg "click" for the invest wheel.
const clickTick = (startIn: number, freq: number, peak: number): void => {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + startIn;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.04);
};

// Evaluate a CSS-style cubic-bezier easing: time fraction → progress.
const cubicBezierEase = (
  x1: number,
  y1: number,
  x2: number,
  y2: number
): ((x: number) => number) => {
  const ax = 1 - 3 * x2 + 3 * x1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;
  const ay = 1 - 3 * y2 + 3 * y1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;
  const sampleX = (s: number) => ((ax * s + bx) * s + cx) * s;
  const sampleY = (s: number) => ((ay * s + by) * s + cy) * s;
  const dX = (s: number) => (3 * ax * s + 2 * bx) * s + cx;
  const solveS = (x: number) => {
    let s = x;
    for (let i = 0; i < 8; i++) {
      const d = dX(s);
      if (Math.abs(d) < 1e-6) break;
      s -= (sampleX(s) - x) / d;
    }
    return Math.min(1, Math.max(0, s));
  };
  return (x: number) => sampleY(solveS(x));
};

/**
 * Big-wheel spin: clicks once per hand passing the pointer, on the SAME
 * easing the reel uses, so the clicking blurs fast at the start and
 * audibly slows to a stop — the casino-wheel ratchet. `ticks` is how
 * many rows scroll past; `durationS` the spin length.
 */
export const sfxWheelSpin = (durationS: number, ticks: number): void => {
  const c = audio();
  if (!c || ticks <= 0) return;
  const ease = cubicBezierEase(0.1, 0.7, 0.1, 1);
  // Invert the easing: displacement fraction → time fraction.
  const timeForFraction = (f: number): number => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      if (ease(mid) < f) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  let lastT = -1;
  for (let k = 1; k <= ticks; k++) {
    const t = timeForFraction(k / ticks) * durationS;
    // Thin out the opening blur — anything under ~26ms apart merges.
    if (t - lastT < 0.026) continue;
    lastT = t;
    const p = k / ticks; // pitch eases down a touch as it slows
    clickTick(t, 1150 - p * 380, 0.05);
  }
};

export type SfxName =
  | 'place'
  | 'chime'
  | 'swap'
  | 'slide'
  | 'destroy'
  | 'enchant'
  | 'riffle'
  | 'revive'
  | 'joker'
  | 'flip';

export const SFX: Record<SfxName, () => void> = {
  place: sfxPlace,
  chime: sfxChime,
  swap: sfxSwap,
  slide: sfxSlide,
  destroy: sfxDestroy,
  enchant: sfxEnchant,
  riffle: sfxRiffle,
  revive: sfxRevive,
  joker: sfxJoker,
  flip: sfxFlip,
};

/**
 * Map a reducer history entry to its sound. The engine logs one entry
 * per committed action with stable prefixes (see src/game/state.ts),
 * which makes this exact — every suit perk and every green one-time
 * action card has a voice. Pure; exported for tests.
 */
export const sfxForHistoryEntry = (entry: string): SfxName | null => {
  if (entry.startsWith('Joker auto-placed')) return 'joker';
  if (entry.startsWith('Place')) return 'place';
  if (entry.startsWith('Hop ')) return 'swap'; // ♥
  if (entry.startsWith('Slide ')) return 'slide'; // ♠
  if (entry.startsWith('Destroy slot')) return 'destroy'; // ♦
  if (entry.startsWith('Bonus draw resolved')) return 'chime'; // ♣ kept/declined
  // Green one-time action cards (Three Tricks / Mixed Bag specials).
  if (entry.startsWith('Power Swap')) return 'swap';
  if (entry.startsWith('Jump ')) return 'swap';
  if (entry.startsWith('Slip & Slide')) return 'slide';
  if (entry.startsWith('Mega Destroy')) return 'destroy';
  if (entry.startsWith('Doubler')) return 'enchant';
  if (entry.startsWith('Wildcard')) return 'enchant';
  if (entry.startsWith('Plus/Minus')) return 'enchant';
  if (entry.startsWith('Shuffle on')) return 'riffle';
  if (entry.startsWith('Rewind on')) return 'riffle';
  if (entry.startsWith('Revive discard')) return 'revive';
  // Double Duty two-way card rotation (+ its unseen burn).
  if (entry.startsWith('Flip')) return 'flip';
  return null; // 'Discard', 'Game start', …
};
