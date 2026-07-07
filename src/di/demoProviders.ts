/**
 * Demo providers for the ?demo= deep links — they exist so every UI state is
 * reachable from a URL (screenshot automation + reviewers trying the app),
 * exactly like the native app's --demo launch flags. They reuse the real
 * seams: the offline demo is the production cache decorator over a dead
 * network — not a special UI path.
 */
import {RatesProvider, RatesResult} from '../api/provider';
import {CachedRatesProvider} from '../api/cachedProvider';
import {InMemorySnapshotStore} from '../storage/snapshotStore';

class DeadNetworkProvider implements RatesProvider {
  latest(): Promise<RatesResult> {
    return Promise.reject(new Error('demo: network unreachable'));
  }
}

/** Dead network over a seeded cache → the honest "stale" UI. */
export function offlineDemoProvider(): RatesProvider {
  const store = new InMemorySnapshotStore();
  store.save('USD-KRW', {
    base: 'USD',
    date: '2026-07-06',
    rates: {KRW: 1391.2, EUR: 0.876, VND: 26120, JPY: 144.5, GBP: 0.73},
    source: 'ecb',
  });
  return new CachedRatesProvider(new DeadNetworkProvider(), store);
}

/** Dead network, empty cache → the error + retry UI. */
export function errorDemoProvider(): RatesProvider {
  return new CachedRatesProvider(new DeadNetworkProvider(), new InMemorySnapshotStore());
}
