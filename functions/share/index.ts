// GET /share?score=...&mode=...&diff=...&date=...&grid=<50-char encoding>
//
// Returns an HTML page whose Open Graph + Twitter Card meta tags point to the
// /share/og.png image generator. When the URL is dropped into iMessage / Slack /
// Discord etc., the client fetches THIS page, parses the meta tags, fetches the
// og:image, and renders the unfurled card.
//
// A human who actually clicks the link sees a small fallback page (styled to
// the site's Morning Paper dark default) and a button to launch the game.
// Daily shares are a challenge on a specific deal, so human visitors are
// forwarded straight to /daily/<date> — unfurl crawlers don't execute the
// script and still read the meta tags.

import { escapeHtml, parseShare, shareTitle } from './_shared';

export const onRequest: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const { score, mode, difficulty, dateISO, seed } = parseShare(url);
  const title = shareTitle(score, mode, difficulty, dateISO);

  // og:image carries the same query params so the image generator sees the
  // same grid/score/mode. Use the request origin so this works on any domain
  // (preview deploys, custom domains, etc.).
  const ogImageUrl = new URL('/share/og.png', url.origin);
  ogImageUrl.search = url.search;

  // Daily: land on that exact puzzle. Free with a seed: the splash's
  // button re-issues the identical deal — the score is a challenge on
  // this exact shuffle. Everything else: the home page.
  const seededPlay =
    seed && difficulty && /^(easy|medium|hard|extreme)$/.test(difficulty)
      ? `${url.origin}/play?difficulty=${difficulty}&seed=${seed}`
      : null;
  const playUrl = dateISO
    ? `${url.origin}/daily/${dateISO}`
    : (seededPlay ?? url.origin + '/');
  const playLabel = dateISO
    ? 'Play this daily'
    : seededPlay
      ? 'Play this deal'
      : 'Play PokerGrid';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />

  <!-- The unfurl card's TITLE (the text under the image) stays a bare
       "PokerGrid" — the score/result lives in the image itself. -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="PokerGrid" />
  <meta property="og:title" content="PokerGrid" />
  <meta property="og:description" content="5×5 poker solitaire. Place every card, score the 10 lines, beat your target." />
  <meta property="og:url" content="${escapeHtml(url.href)}" />
  <meta property="og:image" content="${escapeHtml(ogImageUrl.href)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="PokerGrid" />
  <meta name="twitter:image" content="${escapeHtml(ogImageUrl.href)}" />
${
  dateISO
    ? `
  <script>window.location.replace(${JSON.stringify(playUrl)});</script>`
    : ''
}
  <style>
    /* Morning Paper dark — mirrors [data-theme='paper-dark'] in
       src/design/tokens.css (the site's default look). */
    html, body {
      margin: 0; padding: 0;
      background: #17150f;
      color: #efe9d8;
      font-family: 'Inter Variable', system-ui, -apple-system, 'Segoe UI', sans-serif;
      min-height: 100vh;
    }
    main {
      max-width: 420px;
      margin: 0 auto;
      padding: 56px 24px;
      text-align: center;
    }
    .card {
      background: #211e17;
      border: 1px solid #3a352a;
      border-radius: 14px;
      padding: 32px 24px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    }
    .wordmark {
      font-family: 'Fraunces Variable', Georgia, 'Times New Roman', serif;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.01em;
      margin: 0 0 20px;
    }
    h1 {
      font-size: 14px;
      font-weight: 600;
      line-height: 1.5;
      margin: 0 0 8px;
      color: #b7ae9b;
    }
    .score {
      font-family: 'Fraunces Variable', Georgia, 'Times New Roman', serif;
      font-size: 64px;
      font-weight: 700;
      line-height: 1.05;
      margin: 8px 0;
      font-variant-numeric: tabular-nums;
    }
    .mode {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #948b77;
      margin-bottom: 28px;
    }
    a.play {
      display: inline-block;
      padding: 13px 28px;
      background: #3a8f68;
      border-radius: 10px;
      color: #17150f;
      text-decoration: none;
      font-weight: 650;
      font-size: 15px;
    }
    a.play:hover {
      filter: brightness(1.08);
    }
  </style>
</head>
<body>
  <main>
    <div class="card">
      <p class="wordmark">PokerGrid</p>
      <h1>${escapeHtml(title)}</h1>
      <div class="score">${score}</div>
      <div class="mode">${escapeHtml(mode)}${difficulty ? ' · ' + escapeHtml(difficulty) : ''}</div>
      <a class="play" href="${escapeHtml(playUrl)}">${escapeHtml(playLabel)}</a>
    </div>
  </main>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Allow ~10 minutes of edge caching since the URL params fully determine
      // the output. Long enough to absorb iMessage/Slack/etc. unfurl bursts.
      'cache-control': 'public, max-age=600',
    },
  });
};
