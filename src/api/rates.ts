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

export type RatesErrorKind =
  | 'badStatus'
  | 'unknownCurrency'
  | 'malformedPayload'
  | 'timeout'
  | 'network';

export class RatesError extends Error {
  constructor(
    readonly kind: RatesErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'RatesError';
  }
}

/**
 * The taxonomy's point: transient failures are worth retrying; everything
 * else is a fact about the request and retrying would just repeat it.
 */
export function isTransient(error: unknown): boolean {
  if (!(error instanceof RatesError)) {
    return false;
  }
  if (error.kind === 'timeout' || error.kind === 'network') {
    return true;
  }
  return (
    error.kind === 'badStatus' &&
    (error.status === 429 || (error.status ?? 0) >= 500)
  );
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

/** How hard to try before giving up. Injectable so tests never sleep. */
export interface RequestPolicy {
  timeoutMs: number;
  retries: number;
  backoffMs: number;
  sleep: (ms: number) => Promise<void>;
}

const DEFAULT_POLICY: RequestPolicy = {
  timeoutMs: 8000,
  retries: 2,
  backoffMs: 300,
  sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
};

/**
 * Routes a pair to the right provider, exactly like DrachmaCore's composite
 * client: both codes ECB-covered → official rates; anything else → community,
 * honestly labeled.
 */
export async function latestRates(
  base: string,
  quote: string,
  fetcher: Fetcher = fetch,
  policy?: Partial<RequestPolicy>,
): Promise<RatesSnapshot> {
  const effective: RequestPolicy = {...DEFAULT_POLICY, ...policy};
  const from = base.toUpperCase();
  const to = quote.toUpperCase();
  if (ECB_CURRENCIES.has(from) && ECB_CURRENCIES.has(to)) {
    return frankfurterLatest(from, fetcher, effective);
  }
  return communityLatest(from, fetcher, effective);
}

/** One attempt: fetch with a deadline, mapping failures into the taxonomy. */
async function fetchWithTimeout(
  url: string,
  fetcher: Fetcher,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(url, {signal: controller.signal});
  } catch (error) {
    if (controller.signal.aborted) {
      throw new RatesError('timeout', `no answer within ${timeoutMs} ms`);
    }
    throw new RatesError(
      'network',
      error instanceof Error ? error.message : 'request failed',
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches until OK or out of patience: transient failures (timeout, network,
 * 429/5xx) get `retries` more attempts with jittered exponential backoff;
 * terminal ones (4xx, malformed) are re-thrown immediately.
 */
async function getOk(
  url: string,
  label: string,
  fetcher: Fetcher,
  policy: RequestPolicy,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= policy.retries; attempt++) {
    if (attempt > 0) {
      const base = policy.backoffMs * 2 ** (attempt - 1);
      await policy.sleep(base + Math.random() * base); // jitter: no stampedes
    }
    try {
      const response = await fetchWithTimeout(url, fetcher, policy.timeoutMs);
      if (response.ok) {
        return response;
      }
      lastError = new RatesError(
        'badStatus',
        `${label} HTTP ${response.status}`,
        response.status,
      );
    } catch (error) {
      lastError = error;
    }
    if (!isTransient(lastError)) {
      break;
    }
  }
  throw lastError;
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
  policy: RequestPolicy,
): Promise<RatesSnapshot> {
  const response = await getOk(
    `${FRANKFURTER}/latest?base=${base}`,
    'Frankfurter',
    fetcher,
    policy,
  );
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
  policy: RequestPolicy,
): Promise<RatesSnapshot> {
  const code = base.toLowerCase();
  const response = await getOk(
    `${COMMUNITY}@latest/v1/currencies/${code}.json`,
    'currency-api',
    fetcher,
    policy,
  );
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
