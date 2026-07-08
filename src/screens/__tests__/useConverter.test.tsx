/**
 * ViewModel tests — the payoff of the provider seam: the hook runs against a
 * fake provider injected through the same context the app uses, no mocks of
 * modules or networks anywhere.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text} from 'react-native';
import {RatesProvider, RatesResult} from '../../api/provider';
import {RatesSnapshot} from '../../api/rates';
import {RatesProviderScope} from '../../di/RatesContext';
import {ConverterState, useConverter} from '../useConverter';

const snapshot: RatesSnapshot = {
  base: 'USD',
  date: '2026-07-06',
  rates: {KRW: 1391.2, EUR: 0.876},
  source: 'ecb',
};

class FakeProvider implements RatesProvider {
  constructor(private readonly outcome: () => Promise<RatesResult>) {}
  latest(): Promise<RatesResult> {
    return this.outcome();
  }
}

let captured: ConverterState;

function Probe(): React.JSX.Element {
  captured = useConverter();
  return <Text>probe</Text>;
}

async function renderWith(provider: RatesProvider) {
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(
      <RatesProviderScope provider={provider}>
        <Probe />
      </RatesProviderScope>,
    );
  });
}

describe('useConverter (the ViewModel hook)', () => {
  it('loads rates and converts the default amount', async () => {
    await renderWith(new FakeProvider(async () => ({snapshot, stale: false})));

    expect(captured.result).toBeCloseTo(139120);
    expect(captured.stale).toBe(false);
    expect(captured.error).toBeNull();
  });

  it('surfaces stale results so the view can say "offline"', async () => {
    await renderWith(new FakeProvider(async () => ({snapshot, stale: true})));

    expect(captured.stale).toBe(true);
    expect(captured.result).toBeCloseTo(139120);
  });

  it('reports an error when the provider throws and cache is empty', async () => {
    await renderWith(new FakeProvider(async () => {
      throw new Error('down');
    }));

    expect(captured.error).toMatch(/Could not load rates/);
    expect(captured.result).toBeNull();
  });

  it('swap exchanges the pair', async () => {
    await renderWith(new FakeProvider(async () => ({snapshot, stale: false})));

    await ReactTestRenderer.act(async () => {
      captured.swap();
    });

    expect(captured.from).toBe('KRW');
    expect(captured.to).toBe('USD');
  });

  it('drops a stale response that resolves after a newer one (race guard)', async () => {
    const newer: RatesSnapshot = {...snapshot, date: '2026-07-07', rates: {KRW: 2000}};
    const provider = new DeferredProvider();
    await renderWith(provider);

    // Second refresh starts while the first is still in flight.
    await ReactTestRenderer.act(async () => {
      captured.refresh();
    });
    // The newer request resolves first…
    await ReactTestRenderer.act(async () => {
      provider.resolvers[1]({snapshot: newer, stale: false});
    });
    // …then the older one lands late and must be ignored.
    await ReactTestRenderer.act(async () => {
      provider.resolvers[0]({snapshot, stale: true});
    });

    expect(captured.snapshot?.rates.KRW).toBe(2000);
    expect(captured.stale).toBe(false);
    expect(captured.loading).toBe(false);
  });

  it('ignores a late failure from a superseded request', async () => {
    const provider = new DeferredProvider();
    await renderWith(provider);

    await ReactTestRenderer.act(async () => {
      captured.refresh();
    });
    await ReactTestRenderer.act(async () => {
      provider.resolvers[1]({snapshot, stale: false});
    });
    await ReactTestRenderer.act(async () => {
      provider.rejectors[0](new Error('slow request finally died'));
    });

    expect(captured.error).toBeNull();
    expect(captured.result).toBeCloseTo(139120);
  });
});

/** A provider whose promises resolve only when the test says so. */
class DeferredProvider implements RatesProvider {
  resolvers: Array<(result: RatesResult) => void> = [];
  rejectors: Array<(error: unknown) => void> = [];

  latest(): Promise<RatesResult> {
    return new Promise((resolve, reject) => {
      this.resolvers.push(resolve);
      this.rejectors.push(reject);
    });
  }
}
