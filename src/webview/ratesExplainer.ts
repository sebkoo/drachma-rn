/**
 * The web half of the app. This content — the provenance policy, which sources
 * are official vs indicative — is exactly what Upstart's own engineering blog
 * says should stay a webview: high in content, updated more often than the app
 * ships, and low on interactivity. So it lives here as bundled HTML (no fetch,
 * so the offline-honesty rule survives) and talks to native over one bridge.
 *
 * The bridge: tapping a pair chip posts a JSON message; the native screen
 * parses it with parseBridgeMessage and drives the same converter seam a deep
 * link would. Web content in, native navigation out.
 */

export interface BridgeConvert {
  from: string;
  to: string;
}

// A bridge is a trust boundary: never assume the web side is honest. Validate
// the same way the deep-link parser does — 3-letter codes only — so a hostile
// payload can't ride through into an outbound request path or a cache key.
const CODE = /^[A-Za-z]{3}$/;

/** Parse a postMessage payload into a convert intent, or null if it isn't one. */
export function parseBridgeMessage(data: string): BridgeConvert | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }
  const message = parsed as {type?: unknown; from?: unknown; to?: unknown};
  if (
    message.type !== 'convert' ||
    typeof message.from !== 'string' ||
    typeof message.to !== 'string' ||
    !CODE.test(message.from) ||
    !CODE.test(message.to)
  ) {
    return null;
  }
  return {from: message.from.toUpperCase(), to: message.to.toUpperCase()};
}

const PAIRS: ReadonlyArray<BridgeConvert> = [
  {from: 'USD', to: 'KRW'},
  {from: 'USD', to: 'JPY'},
  {from: 'EUR', to: 'USD'},
  {from: 'USD', to: 'VND'},
];

/** Bundled explainer HTML, themed to match the native shell. */
export function explainerHtml(dark: boolean): string {
  const bg = dark ? '#111418' : '#FFFFFF';
  const text = dark ? '#F3F4F6' : '#1A1A1A';
  const muted = dark ? '#9CA3AF' : '#6B7280';
  const accent = dark ? '#8AB4F8' : '#1F3A5F';
  const onAccent = dark ? '#111418' : '#FFFFFF';
  const border = dark ? '#374151' : '#D1D5DB';

  const chips = PAIRS.map(
    pair =>
      `<button class="chip" onclick='send(${JSON.stringify(pair)})'>` +
      `${pair.from}/${pair.to}</button>`,
  ).join('');

  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
  :root { color-scheme: ${dark ? 'dark' : 'light'}; }
  body { margin: 0; padding: 20px; background: ${bg}; color: ${text};
    font: 16px/1.5 -apple-system, Roboto, sans-serif; }
  h1 { font-size: 20px; margin: 0 0 12px; }
  h2 { font-size: 15px; margin: 20px 0 6px; }
  p { margin: 0 0 10px; color: ${text}; }
  .muted { color: ${muted}; font-size: 14px; }
  .card { border: 1px solid ${border}; border-radius: 12px; padding: 14px; margin: 12px 0; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
  .chip { background: ${accent}; color: ${onAccent}; border: 0; border-radius: 8px;
    padding: 8px 12px; font-size: 14px; font-weight: 600; }
</style>
</head>
<body>
  <h1>About these rates</h1>
  <p>Every rate in Drachma says where it came from. Two sources, never mixed up:</p>

  <div class="card">
    <h2>ECB reference</h2>
    <p class="muted">Official European Central Bank reference rates, for the ~30 currencies
      it publishes. Shown as <b>ECB reference</b> with the working day.</p>
  </div>

  <div class="card">
    <h2>Community (indicative)</h2>
    <p class="muted">For the long tail (300+ currencies) we use a community source and say so —
      labeled <b>Community (indicative)</b>. Indicative data is never dressed up as official.</p>
  </div>

  <h2>Try a pair</h2>
  <p class="muted">Tapping one hands off to the native converter — same seam a deep link uses.</p>
  <div class="chips">${chips}</div>

  <script>
    function send(pair) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'convert', from: pair.from, to: pair.to })
      );
    }
  </script>
</body>
</html>`;
}
