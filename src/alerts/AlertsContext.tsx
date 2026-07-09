/**
 * Composition root for the alerts feature — mirrors RatesContext. It builds one
 * WriteQueue (mock service + AsyncStorage-backed queue) and shares it, so the
 * screen and the hook talk to the same queue instance. Tests inject their own.
 */
import React, {createContext, useContext, useMemo} from 'react';
import {MockAlertsService} from './alertsService';
import {AsyncStorageQueueStore} from './queueStore';
import {WriteQueue} from './writeQueue';

const AlertsContext = createContext<WriteQueue | null>(null);

function defaultQueue(): WriteQueue {
  return new WriteQueue(new MockAlertsService(), new AsyncStorageQueueStore());
}

export function AlertsScope(props: {
  queue?: WriteQueue;
  children: React.ReactNode;
}): React.JSX.Element {
  // Build once per scope unless an explicit queue is injected.
  const queue = useMemo(() => props.queue ?? defaultQueue(), [props.queue]);
  return (
    <AlertsContext.Provider value={queue}>
      {props.children}
    </AlertsContext.Provider>
  );
}

export function useAlertsQueue(): WriteQueue {
  const queue = useContext(AlertsContext);
  if (!queue) {
    throw new Error('useAlertsQueue must be used within an AlertsScope');
  }
  return queue;
}
