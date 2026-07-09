import {MockAlertsService, failFirst} from '../alertsService';
import {SyncError, WriteOp} from '../types';

function createOp(key: string, to = 'KRW'): WriteOp {
  return {
    key,
    kind: {type: 'create', input: {from: 'USD', to, threshold: 1400, direction: 'above'}},
    status: 'pending',
    attempts: 0,
  };
}

describe('MockAlertsService — the idempotency ledger', () => {
  it('applies a create once', async () => {
    const service = new MockAlertsService();
    const alerts = await service.apply(createOp('op1'));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({from: 'USD', to: 'KRW', threshold: 1400});
  });

  it('replaying the SAME key does not create a duplicate', async () => {
    const service = new MockAlertsService();
    await service.apply(createOp('op1'));
    const afterReplay = await service.apply(createOp('op1')); // lost-ack retry
    expect(afterReplay).toHaveLength(1); // not 2
  });

  it('distinct keys create distinct alerts', async () => {
    const service = new MockAlertsService();
    await service.apply(createOp('op1', 'KRW'));
    const alerts = await service.apply(createOp('op2', 'JPY'));
    expect(alerts).toHaveLength(2);
  });

  it('a delete removes a confirmed alert', async () => {
    const service = new MockAlertsService(undefined, () => 'srv_fixed');
    await service.apply(createOp('op1'));
    const op: WriteOp = {
      key: 'op2',
      kind: {type: 'delete', id: 'srv_fixed'},
      status: 'pending',
      attempts: 0,
    };
    expect(await service.apply(op)).toHaveLength(0);
  });

  it('failFirst throws a transient SyncError the configured number of times', async () => {
    const service = new MockAlertsService(failFirst(1));
    await expect(service.apply(createOp('op1'))).rejects.toBeInstanceOf(SyncError);
    // Second call for the same key clears the gate and applies.
    const alerts = await service.apply(createOp('op1'));
    expect(alerts).toHaveLength(1);
  });
});
