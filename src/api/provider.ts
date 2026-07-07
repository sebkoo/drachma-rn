/**
 * The provider seam — the TypeScript translation of DrachmaCore's
 * `PairRatesProviding` protocol. Screens depend on this interface, never on a
 * concrete API client, so swapping or wrapping providers (live, cached, mock)
 * costs one line at the composition root.
 */
import {RatesSnapshot, latestRates} from './rates';

export interface RatesResult {
  snapshot: RatesSnapshot;
  /** True when the network failed and this is the last good snapshot. */
  stale: boolean;
}

export interface RatesProvider {
  latest(base: string, quote: string): Promise<RatesResult>;
}

/** Live provider: routes to Frankfurter/community per the platform's rules. */
export class LiveRatesProvider implements RatesProvider {
  async latest(base: string, quote: string): Promise<RatesResult> {
    return {snapshot: await latestRates(base, quote), stale: false};
  }
}
