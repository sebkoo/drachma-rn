/**
 * The alerts ViewModel — a hook over the framework-agnostic WriteQueue. It
 * subscribes to the queue with useSyncExternalStore (the right primitive for
 * an external mutable source: no stale closures, no manual re-render bugs),
 * hydrates + flushes on mount, and exposes intent-shaped actions the screen
 * calls without knowing the queue exists.
 */
import {useCallback, useEffect, useSyncExternalStore} from 'react';
import {useAlertsQueue} from './AlertsContext';
import {ProjectedAlert} from './projection';
import {AlertInput, WriteOp} from './types';

export interface AlertsViewModel {
  alerts: ProjectedAlert[];
  pending: readonly WriteOp[];
  hasUnsynced: boolean;
  create: (input: AlertInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
  retry: (key: string) => Promise<void>;
  sync: () => Promise<void>;
}

export function useAlerts(): AlertsViewModel {
  const queue = useAlertsQueue();

  // projected() returns a cached array that only changes on a real mutation,
  // so it is a stable snapshot — no per-render allocation, no update loop.
  const projected = useSyncExternalStore(
    useCallback(listener => queue.subscribe(listener), [queue]),
    useCallback(() => queue.projected(), [queue]),
  );

  // Load persisted writes + confirmed server state, then push anything queued.
  useEffect(() => {
    let live = true;
    queue.hydrate().then(() => {
      if (live) {
        queue.flush();
      }
    });
    return () => {
      live = false;
    };
  }, [queue]);

  const create = useCallback(
    async (input: AlertInput) => {
      await queue.create(input);
      await queue.flush();
    },
    [queue],
  );

  const remove = useCallback(
    async (id: string) => {
      await queue.remove(id);
      await queue.flush();
    },
    [queue],
  );

  const retry = useCallback(
    async (key: string) => {
      await queue.retry(key);
      await queue.flush();
    },
    [queue],
  );

  const sync = useCallback(() => queue.flush(), [queue]);

  const pending = queue.pending();
  return {
    alerts: projected,
    pending,
    hasUnsynced: pending.some(op => op.status !== 'synced'),
    create,
    remove,
    retry,
    sync,
  };
}
