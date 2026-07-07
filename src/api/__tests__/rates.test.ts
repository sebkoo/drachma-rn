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

  it('surfaces HTTP failures as RatesError', async () => {
    const fetcher = jest.fn(async () => jsonResponse({}, 503));

    await expect(
      latestRates('USD', 'EUR', fetcher as typeof fetch),
    ).rejects.toThrow(RatesError);
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
