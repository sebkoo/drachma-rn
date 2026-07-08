import {
  ECB_CURRENCIES,
  RatesError,
  RatesSnapshot,
  convert,
  latestRates,
  sourceLabel,
} from '../rates';

const ecbSnapshot: RatesSnapshot = {
  base: 'USD',
  date: '2026-07-06',
  rates: {EUR: 0.876, KRW: 1391.2},
  source: 'ecb',
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status === 200,
    status,
    json: async () => body,
  } as Response;
}

/** Retries stay on, but nobody sleeps in a unit test. */
const instantPolicy = {sleep: async () => {}};

describe('convert', () => {
  it('multiplies by the snapshot rate', () => {
    expect(convert(ecbSnapshot, 100, 'USD', 'EUR')).toBeCloseTo(87.6);
  });

  it('is the identity for a same-currency pair', () => {
    expect(convert(ecbSnapshot, 42, 'USD', 'USD')).toBe(42);
  });

  it('rejects a base mismatch', () => {
    expect(() => convert(ecbSnapshot, 1, 'EUR', 'KRW')).toThrow(RatesError);
  });

  it('rejects an unknown quote currency', () => {
    expect(() => convert(ecbSnapshot, 1, 'USD', 'XXX')).toThrow(RatesError);
  });
});

describe('latestRates routing', () => {
  it('routes an ECB-covered pair to Frankfurter and labels it ecb', async () => {
    const fetcher = jest.fn(async (url: RequestInfo | URL) => {
      expect(String(url)).toContain('frankfurter');
      return jsonResponse({base: 'USD', date: '2026-07-06', rates: {EUR: 0.876}});
    });

    const snapshot = await latestRates('usd', 'eur', fetcher as typeof fetch);

    expect(snapshot.source).toBe('ecb');
    expect(snapshot.rates.EUR).toBeCloseTo(0.876);
  });

  it('routes a non-ECB quote (VND) to the community source and labels it', async () => {
    const fetcher = jest.fn(async (url: RequestInfo | URL) => {
      expect(String(url)).toContain('currency-api');
      return jsonResponse({date: '2026-07-06', usd: {vnd: 26120, eur: 0.876}});
    });

    const snapshot = await latestRates('USD', 'VND', fetcher as typeof fetch);

    expect(snapshot.source).toBe('community');
    expect(snapshot.rates.VND).toBe(26120);
  });

  it('surfaces HTTP failures as RatesError after exhausting retries', async () => {
    const fetcher = jest.fn(async () => jsonResponse({}, 503));

    await expect(
      latestRates('USD', 'EUR', fetcher as typeof fetch, instantPolicy),
    ).rejects.toThrow(RatesError);
    // 503 is transient: 1 attempt + 2 retries.
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('recovers when a transient failure clears mid-retry', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(
        jsonResponse({base: 'USD', date: '2026-07-06', rates: {EUR: 0.876}}),
      );

    const snapshot = await latestRates(
      'USD',
      'EUR',
      fetcher as typeof fetch,
      instantPolicy,
    );

    expect(snapshot.rates.EUR).toBeCloseTo(0.876);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not retry terminal statuses like 404', async () => {
    const fetcher = jest.fn(async () => jsonResponse({}, 404));

    await expect(
      latestRates('USD', 'EUR', fetcher as typeof fetch, instantPolicy),
    ).rejects.toThrow(/HTTP 404/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('maps a dead connection to a retryable network error', async () => {
    const fetcher = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });

    const failure = latestRates('USD', 'EUR', fetcher as typeof fetch, instantPolicy);
    await expect(failure).rejects.toMatchObject({kind: 'network'});
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('turns a hung request into a timeout error', async () => {
    const fetcher = jest.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('Aborted'), {name: 'AbortError'})),
          );
        }),
    );

    const failure = latestRates('USD', 'EUR', fetcher as typeof fetch, {
      ...instantPolicy,
      timeoutMs: 5,
      retries: 0,
    });
    await expect(failure).rejects.toMatchObject({kind: 'timeout'});
  });

  it('rejects a malformed Frankfurter payload', async () => {
    const fetcher = jest.fn(async () => jsonResponse({unexpected: true}));

    await expect(
      latestRates('USD', 'EUR', fetcher as typeof fetch),
    ).rejects.toThrow(RatesError);
  });
});

describe('provenance labeling', () => {
  it('labels ECB data as reference', () => {
    expect(sourceLabel(ecbSnapshot)).toBe('ECB reference · 2026-07-06');
  });

  it('labels community data as indicative — never dressed up as official', () => {
    const community: RatesSnapshot = {...ecbSnapshot, source: 'community'};
    expect(sourceLabel(community)).toBe('Community (indicative) · 2026-07-06');
  });

  it('keeps the ECB set at the 30 currencies Frankfurter serves', () => {
    expect(ECB_CURRENCIES.size).toBe(30);
    expect(ECB_CURRENCIES.has('USD')).toBe(true);
    expect(ECB_CURRENCIES.has('VND')).toBe(false);
  });
});
