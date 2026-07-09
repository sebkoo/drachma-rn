import {MockAlertsService, failFirst, FailurePolicy} from '../alertsService';
import {InMemoryQueueStore} from '../queueStore';
import {OpKind, SyncError, WriteOp} from '../types';
import {WriteQueue} from '../writeQueue';

const CREATE: OpKind = {
  type: 'create',
  input: {from: 'USD', to: 'KRW', threshold: 1400, direction: 'above'},
};

/** Deterministic keys so assertions don't depend on time. */
function keyFactory() {
  let n = 0;
  return () => `op_${++n}`;
}

function makeQueue(
  service = new MockAlertsService(),
  store = new InMemoryQueueStore(),
  options = {},
) {
  return new WriteQueue(service, store, {
    sleep: async () => {}, // never actually wait in tests
    keyFactory: keyFactory(),
    ...options,
  });
}

describe('WriteQueue', () => {
  it('shows a create optimistically before the flush confirms it', async () => {
    const queue = makeQueue();
    await queue.enqueue(CREATE);

    const view = queue.projected();
    expect(view).toHaveLength(1);
    expect(view[0]).toMatchObject({pending: true, to: 'KRW'});
    expect(queue.confirmedAlerts()).toHaveLength(0); // server not called yet
  });

  it('flushes a pending create and reconciles it to confirmed', async () => {
    const queue = makeQueue();
    await queue.enqueue(CREATE);
    await queue.flush();

    expect(queue.confirmedAlerts()).toHaveLength(1);
    expect(queue.pending()).toHaveLength(0); // synced op dropped
    expect(queue.projected()[0]).toMatchObject({pending: false, failed: false});
  });

  it('retries a transient failure with backoff and eventually syncs', async () => {
    const service = new MockAlertsService(failFirst(2));
    const queue = makeQueue(service, new InMemoryQueueStore(), {retries: 3});
    const op = await queue.enqueue(CREATE);
    await queue.flush();

    expect(queue.confirmedAlerts()).toHaveLength(1);
    expect(op.attempts).toBe(3); // 2 failures + 1 success
  });

  it('marks an op failed after exhausting retries and keeps it queued', async () => {
    const service = new MockAlertsService(failFirst(10)); // never clears
    const queue = makeQueue(service, new InMemoryQueueStore(), {retries: 2});
    await queue.enqueue(CREATE);
    await queue.flush();

    expect(queue.confirmedAlerts()).toHaveLength(0);
    const pending = queue.pending();
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe('failed');
    expect(queue.projected()[0]).toMatchObject({failed: true});
  });

  it('does not retry a non-transient failure', async () => {
    const nonTransient: FailurePolicy = {
      gate() {
        throw new SyncError('permanent', false);
      },
    };
    const service = new MockAlertsService(nonTransient);
    const queue = makeQueue(service, new InMemoryQueueStore(), {retries: 3});
    const op = await queue.enqueue(CREATE);
    await queue.flush();

    expect(op.status).toBe('failed');
    expect(op.attempts).toBe(1); // one try, no retries
  });

  it('retry() re-drives a failed op to success', async () => {
    // First flush = 2 attempts (both gated); retry's flush = attempt 3 (gated)
    // then attempt 4 (clears), so failFirst(3) lands on the retry.
    const service = new MockAlertsService(failFirst(3));
    const queue = makeQueue(service, new InMemoryQueueStore(), {retries: 1});
    const op = await queue.enqueue(CREATE);
    await queue.flush();
    expect(op.status).toBe('failed');

    // The gate clears after enough attempts; a manual retry now succeeds.
    await queue.retry(op.key);
    await queue.flush();
    expect(queue.confirmedAlerts()).toHaveLength(1);
  });

  it('survives a restart: a persisted op is rehydrated and flushed', async () => {
    const store = new InMemoryQueueStore();
    const service = new MockAlertsService();

    const first = makeQueue(service, store);
    await first.enqueue(CREATE); // persisted, not flushed (app "killed")

    const second = new WriteQueue(service, store, {sleep: async () => {}});
    await second.hydrate();
    expect(second.pending()).toHaveLength(1);
    await second.flush();
    expect(second.confirmedAlerts()).toHaveLength(1);
  });

  it('a replayed op after a lost ack does not double-apply', async () => {
    const store = new InMemoryQueueStore();
    const service = new MockAlertsService();

    // Simulate: the server applied the op last run, but the ack was lost, so
    // the queue still has it as pending in storage.
    const applied: WriteOp = {key: 'op_lost', kind: CREATE, status: 'pending', attempts: 1};
    await service.apply(applied); // server ledger now holds op_lost
    await store.save([applied]); // queue thinks it is still pending

    const queue = new WriteQueue(service, store, {sleep: async () => {}});
    await queue.hydrate();
    await queue.flush();

    // Idempotency: exactly one alert, not two.
    expect(queue.confirmedAlerts()).toHaveLength(1);
    expect(queue.pending()).toHaveLength(0);
  });

  it('coalesces a concurrent flush of the same op into one apply', async () => {
    let resolveApply: (value: never[]) => void = () => {};
    const service = {
      list: async () => [],
      apply: jest.fn(
        () => new Promise<never[]>(resolve => {
          resolveApply = resolve;
        }),
      ),
    };
    const queue = new WriteQueue(service, new InMemoryQueueStore(), {
      sleep: async () => {},
      keyFactory: keyFactory(),
    });
    await queue.enqueue(CREATE);

    const first = queue.flush();
    const second = queue.flush(); // coalesced; must not re-apply the same op
    resolveApply([]);
    await Promise.all([first, second]);

    expect(service.apply).toHaveBeenCalledTimes(1);
  });

  it('does not strand an op enqueued during an in-flight flush', async () => {
    const service = new MockAlertsService();
    const store = new InMemoryQueueStore();
    const queue = new WriteQueue(service, store, {
      sleep: async () => {},
      keyFactory: keyFactory(),
    });
    await queue.enqueue(CREATE); // op A

    // Start a flush, and while A is in flight enqueue B + request another flush.
    const firstFlush = queue.flush();
    await queue.enqueue({
      type: 'create',
      input: {from: 'USD', to: 'JPY', threshold: 150, direction: 'below'},
    });
    await Promise.all([firstFlush, queue.flush()]);

    // Both A and B must have synced — B was not lost to the re-entrant guard.
    expect(queue.confirmedAlerts()).toHaveLength(2);
    expect(queue.pending()).toHaveLength(0);
  });

  it('rebuilds confirmed alerts from the server on restart', async () => {
    const service = new MockAlertsService();
    const store = new InMemoryQueueStore();

    const first = makeQueue(service, store);
    await first.enqueue(CREATE);
    await first.flush(); // synced; op dropped from the queue

    // New session, same server: hydrate must re-read confirmed via list().
    const second = new WriteQueue(service, store, {sleep: async () => {}});
    await second.hydrate();
    expect(second.confirmedAlerts()).toHaveLength(1);
    expect(second.projected()).toHaveLength(1);
  });

  it('remove() cancels an optimistic create instead of round-tripping it', async () => {
    const service = new MockAlertsService();
    const queue = makeQueue(service);
    const op = await queue.create({from: 'USD', to: 'KRW', threshold: 1400, direction: 'above'});

    await queue.remove(op.key); // deleted before it ever synced
    expect(queue.pending()).toHaveLength(0);
    expect(queue.projected()).toHaveLength(0);

    await queue.flush();
    expect(queue.confirmedAlerts()).toHaveLength(0); // never armed on the server
  });

  it('a failed delete stops hiding the alert — deletion did not happen', async () => {
    const service = new MockAlertsService(); // create succeeds
    const queue = makeQueue(service);
    await queue.create({from: 'USD', to: 'KRW', threshold: 1400, direction: 'above'});
    await queue.flush();
    const serverId = queue.confirmedAlerts()[0].id;

    // Now make the network fail terminally and try to delete.
    const failing = new WriteQueue(
      {
        list: () => service.list(),
        apply: () => Promise.reject(new SyncError('down', false)),
      },
      new InMemoryQueueStore(),
      {sleep: async () => {}, keyFactory: keyFactory()},
    );
    await failing.refresh(); // pull confirmed [srv]
    await failing.remove(serverId);
    await failing.flush();

    expect(failing.pending()[0].status).toBe('failed');
    // The alert is visible again: the deletion is not a fact yet.
    expect(failing.projected().map(a => a.id)).toContain(serverId);
  });

  it('notifies subscribers on state changes', async () => {
    const queue = makeQueue();
    const listener = jest.fn();
    queue.subscribe(listener);
    await queue.enqueue(CREATE);
    expect(listener).toHaveBeenCalled();
  });
});
