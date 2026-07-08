import {CachedRatesProvider} from '../cachedProvider';
import {RatesProvider, RatesResult} from '../provider';
import {RatesSnapshot} from '../rates';
import {InMemorySnapshotStore} from '../../storage/snapshotStore';

const snapshot: RatesSnapshot = {
  base: 'USD',
  date: '2026-07-06',
  rates: {KRW: 1391.2},
  source: 'ecb',
};

class FlakyProvider implements RatesProvider {
  failing = false;
  calls = 0;

  async latest(): Promise<RatesResult> {
    this.calls += 1;
    if (this.failing) {
      throw new Error('network down');
    }
    return {snapshot, stale: false};
  }
}

describe('CachedRatesProvider — the offline last-good decorator', () => {
  it('passes through fresh results and saves them', async () => {
    const store = new InMemorySnapshotStore();
    const provider = new CachedRatesProvider(new FlakyProvider(), store);

    const result = await provider.latest('USD', 'KRW');

    expect(result.stale).toBe(false);
    expect(await store.load('USD-KRW')).toEqual(snapshot);
  });

  it('serves the last good snapshot marked stale when the network fails', async () => {
    const store = new InMemorySnapshotStore();
    const flaky = new FlakyProvider();
    const provider = new CachedRatesProvider(flaky, store);

    await provider.latest('USD', 'KRW'); // warm the cache
    flaky.failing = true;
    const result = await provider.latest('USD', 'KRW');

    expect(result.stale).toBe(true);
    expect(result.snapshot).toEqual(snapshot);
  });

  it('rethrows when the network fails and there is no cache — no fake data', async () => {
    const flaky = new FlakyProvider();
    flaky.failing = true;
    const provider = new CachedRatesProvider(flaky, new InMemorySnapshotStore());

    await expect(provider.latest('USD', 'KRW')).rejects.toThrow('network down');
  });

  it('a broken cache read never replaces the real network error', async () => {
    const brokenStore = new InMemorySnapshotStore();
    brokenStore.load = async () => {
      throw new Error('storage locked');
    };
    const flaky = new FlakyProvider();
    flaky.failing = true;
    const provider = new CachedRatesProvider(flaky, brokenStore);

    // The original failure is the truth worth surfacing — not the cache's.
    await expect(provider.latest('USD', 'KRW')).rejects.toThrow('network down');
  });

  it('a cache-write failure never downgrades a successful fetch', async () => {
    const brokenStore = new InMemorySnapshotStore();
    brokenStore.save = async () => {
      throw new Error('disk full');
    };
    const provider = new CachedRatesProvider(new FlakyProvider(), brokenStore);

    const result = await provider.latest('USD', 'KRW');

    expect(result.stale).toBe(false);
    expect(result.snapshot).toEqual(snapshot);
  });
});
