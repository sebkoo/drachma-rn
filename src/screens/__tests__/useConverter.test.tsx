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
});
