import { Card, isJoker } from '../game/cards';
import { Grid } from '../game/grid';

// Two-char fixed encoding per cell (50 chars total for a 5×5 grid). Matches
// the decoder in the share OG-image function (ported from the original
// repo's functions/share/_shared.ts).
//   '__' = empty
//   'JK' = joker
//   '<rank><suit>' = standard card. Rank '10' is encoded as 'T' so each cell
//                    stays at exactly two characters.
const encodeCell = (c: Card | null): string => {
  if (!c) return '__';
  if (isJoker(c)) return 'JK';
  const rank = c.rank === '10' ? 'T' : c.rank;
  return `${rank}${c.suit}`;
};

export const encodeGrid = (grid: Grid): string =>
  grid.map(encodeCell).join('');

export interface ShareParams {
  score: number;
  mode: 'free' | 'targets-up' | 'challenge' | 'daily';
  difficulty?: string;
  grid: Grid;
  /** Daily shares carry their date (ISO) so the link lands the
   *  recipient on that exact puzzle — the shared score is a
   *  challenge, and this is the deal to beat it on. */
  dateISO?: string;
}

// Build the absolute /share URL the player will hand off, anchored on the
// deployed origin.
export const buildShareUrl = (params: ShareParams): string => {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://pokergrid.app';
  const u = new URL('/share', origin);
  u.searchParams.set('score', String(params.score));
  u.searchParams.set('mode', params.mode);
  if (params.difficulty) u.searchParams.set('diff', params.difficulty);
  if (params.dateISO) u.searchParams.set('date', params.dateISO);
  u.searchParams.set('grid', encodeGrid(params.grid));
  return u.toString();
};

export interface ShareResult {
  // 'shared' = native share sheet completed; 'copied' = URL went to the
  // clipboard; 'failed' = neither path worked (user denied permission, etc.).
  outcome: 'shared' | 'copied' | 'failed';
}

// "Share this URL": first attempt the Web Share API (which on iOS / Android
// browsers opens the system share sheet → iMessage, Slack, Mail, etc.),
// then fall back to copying to the clipboard.
export const shareUrl = async (
  url: string,
  title: string
): Promise<ShareResult> => {
  if (typeof navigator === 'undefined') return { outcome: 'failed' };
  const nav = navigator as Navigator & {
    share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
    clipboard?: { writeText?: (s: string) => Promise<void> };
  };
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ title, text: title, url });
      return { outcome: 'shared' };
    } catch (e) {
      // AbortError = user dismissed. Don't fall back to clipboard in that
      // case; just report failure so the caller can stay quiet.
      const name = (e as { name?: string } | null)?.name;
      if (name === 'AbortError') return { outcome: 'failed' };
      // Other errors: fall through to clipboard.
    }
  }
  if (nav.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(url);
      return { outcome: 'copied' };
    } catch {
      return { outcome: 'failed' };
    }
  }
  return { outcome: 'failed' };
};
