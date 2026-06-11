// Tiny WebAudio synth — no audio assets. Soft, papery sounds in keeping
// with the editorial feel: a felt-damped tick for placement, a small
// chime for bonus draws, short resolutions for game end. Callers gate
// on the sounds setting; this module only owns synthesis.

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
  type: OscillatorType = 'sine'
): void => {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + startIn;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
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

/** Suit perk fired / bonus card drawn — a small two-note chime. */
export const sfxChime = (): void => {
  tone(523.25, 0, 0.12, 0.06);
  tone(783.99, 0.07, 0.16, 0.05);
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
