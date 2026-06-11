import { Grid } from '../../../game/grid';
import { useToast } from '../../../design/primitives';
import { ShareParams, buildShareUrl, shareUrl } from '../../../lib/share';

/**
 * "Share" in the result dock: native share sheet where available,
 * clipboard fallback. The URL unfurls via the /share OG function.
 */
export function ShareButton({
  score,
  mode,
  difficulty,
  grid,
}: {
  score: number;
  mode: ShareParams['mode'];
  difficulty?: string;
  grid: Grid;
}) {
  const { toast } = useToast();

  const onShare = async () => {
    const url = buildShareUrl({ score, mode, difficulty, grid });
    const result = await shareUrl(url, `PokerGrid — ${score} points`);
    if (result.outcome === 'copied') toast('Link copied.', 'success');
    else if (result.outcome === 'failed') toast('Could not share.', 'danger');
  };

  return (
    <button
      type="button"
      onClick={onShare}
      style={{
        font: 'inherit',
        fontSize: 14,
        fontWeight: 500,
        color: 'var(--accent)',
      }}
    >
      Share
    </button>
  );
}
