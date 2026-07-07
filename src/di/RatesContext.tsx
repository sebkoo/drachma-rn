/**
 * Composition root — the one place that decides which concrete provider the
 * app runs on (live + offline cache on device; anything you want in tests).
 * The RN translation of the native app's protocol-oriented injection.
 */
import React, {createContext, useContext} from 'react';
import {RatesProvider, LiveRatesProvider} from '../api/provider';
import {CachedRatesProvider} from '../api/cachedProvider';
import {AsyncStorageSnapshotStore} from '../storage/snapshotStore';

const defaultProvider: RatesProvider = new CachedRatesProvider(
  new LiveRatesProvider(),
  new AsyncStorageSnapshotStore(),
);

const RatesContext = createContext<RatesProvider>(defaultProvider);

export function RatesProviderScope(props: {
  provider?: RatesProvider;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <RatesContext.Provider value={props.provider ?? defaultProvider}>
      {props.children}
    </RatesContext.Provider>
  );
}

export function useRatesProvider(): RatesProvider {
  return useContext(RatesContext);
}
