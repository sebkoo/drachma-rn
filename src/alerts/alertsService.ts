/**
 * The alerts "server" — mock-first, like the rest of Drachma. There is no real
 * backend; this stands in for one so the write path (queue, idempotency,
 * retries, optimistic UI) is real and testable without a network.
 *
 * The one thing it models faithfully is the property that makes at-least-once
 * delivery survivable: idempotency. `apply` records every op key it has seen;
 * replaying the same key is a no-op that returns the current state, so a retry
 * after a lost ack never creates a duplicate alert.
 */
import {Alert, SyncError, WriteOp} from './types';

export interface AlertsService {
  /** The server's current alerts — the read path a client rebuilds from on
   *  launch (GET /alerts). Confirmed state lives on the server, not the queue. */
  list(): Promise<Alert[]>;
  /** Apply one write and return the full alert list the server now holds. */
  apply(op: WriteOp): Promise<Alert[]>;
}

/** Injected so the demo can make the network flaky without real sockets. */
export interface FailurePolicy {
  /** Called before each apply; throw to simulate a failure. */
  gate(op: WriteOp): void;
}

export const alwaysSucceeds: FailurePolicy = {gate: () => {}};

/** Fails the first `n` attempts of every op with a transient error. */
export function failFirst(n: number): FailurePolicy {
  const seen = new Map<string, number>();
  return {
    gate(op) {
      const count = (seen.get(op.key) ?? 0) + 1;
      seen.set(op.key, count);
      if (count <= n) {
        throw new SyncError(`transient failure ${count}/${n}`, true);
      }
    },
  };
}

export class MockAlertsService implements AlertsService {
  /** Idempotency ledger: op keys already applied. This is the whole trick. */
  private readonly appliedKeys = new Set<string>();
  private readonly alerts = new Map<string, Alert>();
  private idSeq = 0;

  constructor(
    private readonly policy: FailurePolicy = alwaysSucceeds,
    /** Deterministic id source so tests don't depend on time/random. */
    private readonly nextId: () => string = () => `srv_${++this.idSeq}`,
  ) {}

  async list(): Promise<Alert[]> {
    return this.snapshot();
  }

  async apply(op: WriteOp): Promise<Alert[]> {
    this.policy.gate(op);

    // Replaying a key that already landed is a no-op — not a second write.
    if (this.appliedKeys.has(op.key)) {
      return this.snapshot();
    }
    this.appliedKeys.add(op.key);

    if (op.kind.type === 'create') {
      const id = this.nextId();
      this.alerts.set(id, {id, ...op.kind.input});
    } else {
      this.alerts.delete(op.kind.id);
    }
    return this.snapshot();
  }

  private snapshot(): Alert[] {
    return Array.from(this.alerts.values());
  }
}
