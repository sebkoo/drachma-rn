/**
 * The optimistic view: what the user should see *now*, before the network has
 * confirmed anything. Pure function of (confirmed server state, pending ops),
 * so it is trivially testable and has no timing in it.
 *
 * Rules:
 *  - A not-yet-synced `create` shows immediately, flagged pending (or failed).
 *  - An *in-progress* `delete` (pending/inFlight) hides its target immediately.
 *  - A `failed` delete stops hiding — the deletion did not happen, so showing
 *    the alert again is the truth; its op stays queued for a retry.
 *  - `synced` ops have already folded into `confirmed`, so they are skipped.
 */
import {Alert, WriteOp} from './types';

/** The ids an in-progress delete is optimistically hiding. */
function optimisticallyDeletedIds(ops: readonly WriteOp[]): Set<string> {
  const ids = new Set<string>();
  for (const op of ops) {
    const inProgress = op.status === 'pending' || op.status === 'inFlight';
    if (op.kind.type === 'delete' && inProgress) {
      ids.add(op.kind.id);
    }
  }
  return ids;
}

export interface ProjectedAlert extends Alert {
  /** In the queue, not yet acked by the server. */
  pending: boolean;
  /** Terminal failure — awaiting the user's retry or discard. */
  failed: boolean;
  /** The idempotency key of the op that created it, if still optimistic. */
  opKey?: string;
}

export function projectAlerts(
  confirmed: readonly Alert[],
  ops: readonly WriteOp[],
): ProjectedAlert[] {
  const deletedIds = optimisticallyDeletedIds(ops);

  const result: ProjectedAlert[] = confirmed
    .filter(alert => !deletedIds.has(alert.id))
    .map(alert => ({...alert, pending: false, failed: false}));

  for (const op of ops) {
    if (op.kind.type !== 'create' || op.status === 'synced') {
      continue;
    }
    // An optimistic create the user then deleted before it synced.
    if (deletedIds.has(op.key)) {
      continue;
    }
    // Optimistic id is the op key: stable, and lets the row reconcile to its
    // real server id once the create acks.
    result.push({
      id: op.key,
      ...op.kind.input,
      pending: op.status !== 'failed',
      failed: op.status === 'failed',
      opKey: op.key,
    });
  }
  return result;
}
