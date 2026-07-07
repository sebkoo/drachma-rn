/**
 * drachma://convert deep links — the RN translation of the native app's
 * launch-flag pattern: URLs drive the app into any user-visible state, which
 * powers both real deep linking and the screenshot automation in docs/.
 *
 *   drachma://convert?from=USD&to=VND&amount=250
 *   drachma://convert?demo=offline   (seeded cache + dead network → stale UI)
 *   drachma://convert?demo=error     (dead network, no cache → error UI)
 *
 * Parsed by hand: Hermes ships an incomplete URL/URLSearchParams, so relying
 * on the WHATWG API works in Jest (Node) and breaks on device.
 */
export interface ConvertLink {
  from?: string;
  to?: string;
  amount?: string;
  demo?: 'offline' | 'error';
}

const CODE = /^[A-Za-z]{3}$/;
const AMOUNT = /^\d+([.,]\d+)?$/;

export function parseConvertLink(url: string): ConvertLink | null {
  const match = url.match(/^drachma:\/\/([^?#]*)(\?([^#]*))?/);
  if (!match || match[1].replace(/\/+$/, '') !== 'convert') {
    return null;
  }

  const params = new Map<string, string>();
  for (const pair of (match[3] ?? '').split('&')) {
    const eq = pair.indexOf('=');
    if (eq > 0) {
      params.set(
        decodeURIComponent(pair.slice(0, eq)),
        decodeURIComponent(pair.slice(eq + 1)),
      );
    }
  }

  const link: ConvertLink = {};
  const from = params.get('from');
  const to = params.get('to');
  const amount = params.get('amount');
  const demo = params.get('demo');

  if (from && CODE.test(from)) {
    link.from = from.toUpperCase();
  }
  if (to && CODE.test(to)) {
    link.to = to.toUpperCase();
  }
  if (amount && AMOUNT.test(amount)) {
    link.amount = amount;
  }
  if (demo === 'offline' || demo === 'error') {
    link.demo = demo;
  }
  return link;
}
