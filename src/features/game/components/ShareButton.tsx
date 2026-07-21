import { useToast } from '../../../design/primitives';
import { ShareParams, buildShareUrl, shareUrl } from '../../../lib/share';

/**
 * "Share" in the result dock: native share sheet where available,
 * clipboard fallback. The URL unfurls via the /share OG function —
 * URL only, no accompanying text.
 */
export function ShareButton({
  score,
  mode,
  difficulty,
  tier,
  variant,
  dateISO,
  seed,
}: {
  score: number;
  mode: ShareParams['mode'];
  difficulty?: string;
  /** Result tier letter (SS/S/A/B/C/D) for the OG card. */
  tier?: string;
  /** Variant name (challenge / daily twist) for the OG card. */
  variant?: string;
  /** Daily only: the puzzle's date, so the link opens that deal. */
  dateISO?: string;
  /** Free play only: the run's seed, so the link re-issues the deal. */
  seed?: number;
}) {
  const { toast } = useToast();

  const onShare = async () => {
    const url = buildShareUrl({
      score,
      mode,
      difficulty,
      tier,
      variant,
      dateISO,
      seed,
    });
    const result = await shareUrl(url);
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
