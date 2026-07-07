/**
 * Rates client for the Drachma platform — the TypeScript twin of
 * DrachmaCore's networking layer (github.com/sebkoo/drachma).
 *
 * Same provenance rules as the native app: ECB reference rates (via
 * Frankfurter, ~30 currencies) are labeled `ecb`; the community source
 * (currency-api, 300+ currencies) is labeled `community` and every surface
 * must render that label — indicative data is never dressed up as official.
 */

export type RateSource = 'ecb' | 'community';

export interface RatesSnapshot {
  base: string;
  /** ECB working day the rates refer to, yyyy-MM-dd. */
  date: string;
  rates: Record<string, number>;
  source: RateSource;
}

export class RatesError extends Error {
  constructor(
    readonly kind: 'badStatus' | 'unknownCurrency' | 'malformedPayload',
    message: string,
  ) {
    super(message);
    this.name = 'RatesError';
  }
}

/** The currencies the ECB publishes reference rates for (via Frankfurter). */
export const ECB_CURRENCIES: ReadonlySet<string> = new Set([
  'AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD',
  'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR', 'NOK',
  'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR',
]);

const FRANKFURTER = 'https://api.frankfurter.dev/v1';
const COMMUNITY = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api';

type Fetcher = typeof fetch;

/**
 * Routes a pair to the right provider, exactly like DrachmaCore's composite
 * client: both codes ECB-covered → official rates; anything else → community,
 * honestly labeled.
 */
export async function latestRates(
  base: string,
  quote: string,
  fetcher: Fetcher = fetch,
): Promise<RatesSnapshot> {
  const from = base.toUpperCase();
  const to = quote.toUpperCase();
  if (ECB_CURRENCIES.has(from) && ECB_CURRENCIES.has(to)) {
    return frankfurterLatest(from, fetcher);
  }
  return communityLatest(from, fetcher);
}

/** Converts an amount using a snapshot; same semantics as DrachmaCore. */
export function convert(
  snapshot: RatesSnapshot,
  amount: number,
  from: string,
  to: string,
): number {
  const source = from.toUpperCase();
  const target = to.toUpperCase();
  if (source === target) {
    return amount;
  }
  if (source !== snapshot.base) {
    throw new RatesError(
      'unknownCurrency',
      `snapshot base is ${snapshot.base}, not ${source}`,
    );
  }
  const rate = snapshot.rates[target];
  if (rate === undefined) {
    throw new RatesError('unknownCurrency', `no rate for ${target}`);
  }
  return amount * rate;
}

async function frankfurterLatest(
  base: string,
  fetcher: Fetcher,
): Promise<RatesSnapshot> {
  const response = await fetcher(`${FRANKFURTER}/latest?base=${base}`);
  if (!response.ok) {
    throw new RatesError('badStatus', `Frankfurter HTTP ${response.status}`);
  }
  const payload = (await response.json()) as {
    base?: string;
    date?: string;
    rates?: Record<string, number>;
  };
  if (!payload.base || !payload.date || !payload.rates) {
    throw new RatesError('malformedPayload', 'Frankfurter payload missing fields');
  }
  return {base: payload.base, date: payload.date, rates: payload.rates, source: 'ecb'};
}

async function communityLatest(
  base: string,
  fetcher: Fetcher,
): Promise<RatesSnapshot> {
  const code = base.toLowerCase();
  const response = await fetcher(`${COMMUNITY}@latest/v1/currencies/${code}.json`);
  if (!response.ok) {
    throw new RatesError('badStatus', `currency-api HTTP ${response.status}`);
  }
  // currency-api keys the rates object by the base code itself:
  // {"date": "...", "usd": {"eur": 0.87, ...}}
  const payload = (await response.json()) as Record<string, unknown>;
  const date = payload.date;
  const raw = payload[code];
  if (typeof date !== 'string' || typeof raw !== 'object' || raw === null) {
    throw new RatesError('malformedPayload', 'currency-api payload missing fields');
  }
  const rates: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number') {
      rates[key.toUpperCase()] = value;
    }
  }
  return {base: base.toUpperCase(), date, rates, source: 'community'};
}

/** The user-facing provenance label — the honesty rule as a function. */
export function sourceLabel(snapshot: RatesSnapshot): string {
  return snapshot.source === 'ecb'
    ? `ECB reference · ${snapshot.date}`
    : `Community (indicative) · ${snapshot.date}`;
}
