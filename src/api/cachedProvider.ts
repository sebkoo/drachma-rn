/**
 * Offline last-good cache as a provider decorator — the same shape as the
 * native app's CachedPairRatesClient: wrap any RatesProvider, save every
 * success, and when the network fails serve the last good snapshot marked
 * `stale` so the UI can say so honestly. No silent staleness.
 */
import {RatesProvider, RatesResult} from './provider';
import {SnapshotStore} from '../storage/snapshotStore';

export class CachedRatesProvider implements RatesProvider {
  constructor(
    private readonly wrapped: RatesProvider,
    private readonly store: SnapshotStore,
  ) {}

  async latest(base: string, quote: string): Promise<RatesResult> {
    const key = `${base.toUpperCase()}-${quote.toUpperCase()}`;
    let result: RatesResult;
    try {
      result = await this.wrapped.latest(base, quote);
    } catch (error) {
      const lastGood = await this.store.load(key);
      if (lastGood) {
        return {snapshot: lastGood, stale: true};
      }
      throw error;
    }
    try {
      await this.store.save(key, result.snapshot);
    } catch {
      // Persistence is best-effort: a cache-write failure must never
      // downgrade a fetch that already succeeded — the snapshot is in hand.
    }
    return result;
  }
}
