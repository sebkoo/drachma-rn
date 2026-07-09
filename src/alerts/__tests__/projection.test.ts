import {projectAlerts} from '../projection';
import {Alert, WriteOp} from '../types';

const confirmed: Alert[] = [
  {id: 'srv_1', from: 'USD', to: 'KRW', threshold: 1400, direction: 'above'},
];

function op(partial: Partial<WriteOp> & Pick<WriteOp, 'key' | 'kind'>): WriteOp {
  return {status: 'pending', attempts: 0, ...partial};
}

describe('projectAlerts — the optimistic view', () => {
  it('shows confirmed alerts as settled', () => {
    const view = projectAlerts(confirmed, []);
    expect(view).toHaveLength(1);
    expect(view[0]).toMatchObject({id: 'srv_1', pending: false, failed: false});
  });

  it('shows a pending create immediately, flagged pending', () => {
    const create = op({
      key: 'op_a',
      kind: {type: 'create', input: {from: 'USD', to: 'JPY', threshold: 150, direction: 'below'}},
    });
    const view = projectAlerts(confirmed, [create]);
    expect(view).toHaveLength(2);
    const optimistic = view.find(a => a.opKey === 'op_a');
    expect(optimistic).toMatchObject({to: 'JPY', pending: true, failed: false, id: 'op_a'});
  });

  it('flags a failed create as failed, not pending', () => {
    const create = op({
      key: 'op_a',
      status: 'failed',
      kind: {type: 'create', input: {from: 'USD', to: 'JPY', threshold: 150, direction: 'below'}},
    });
    const view = projectAlerts([], [create]);
    expect(view[0]).toMatchObject({failed: true, pending: false});
  });

  it('hides an alert with a pending delete immediately', () => {
    const del = op({key: 'op_d', kind: {type: 'delete', id: 'srv_1'}});
    expect(projectAlerts(confirmed, [del])).toHaveLength(0);
  });

  it('ignores synced ops — they have already folded into confirmed', () => {
    const syncedCreate = op({
      key: 'op_a',
      status: 'synced',
      kind: {type: 'create', input: {from: 'USD', to: 'JPY', threshold: 150, direction: 'below'}},
    });
    const view = projectAlerts(confirmed, [syncedCreate]);
    expect(view).toHaveLength(1); // only the confirmed one
    expect(view[0].id).toBe('srv_1');
  });
});
