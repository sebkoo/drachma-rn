/**
 * The offline write queue. Every write goes in here first, is persisted, and
 * is flushed against the service with bounded retries. Because each op carries
 * a stable idempotency key, a replay after a lost ack — the classic "did my
 * payment go through?" failure — folds into a no-op instead of a duplicate.
 *
 * Framework-agnostic on purpose: no React here, so the whole state machine is
 * unit-tested against a fake service. A hook (Stage B) subscribes for the UI.
 */
import {AlertsService} from './alertsService';
import {ProjectedAlert, projectAlerts} from './projection';
import {QueueStore} from './queueStore';
import {Alert, AlertInput, OpKind, SyncError, WriteOp} from './types';

export interface QueueOptions {
  /** Retries after the first attempt, for transient failures only. */
  retries?: number;
  backoffMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Idempotency-key source. Injectable so tests are deterministic. */
  keyFactory?: () => string;
}

let counter = 0;
// A client-owned idempotency key: process-monotonic counter + a random chunk,
// so two devices (or a reinstall that resets the counter) enqueuing in the
// same millisecond still produce distinct keys.
const defaultKeyFactory = (): string =>
  `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}_${counter++}`;

export class WriteQueue {
  private ops: WriteOp[] = [];
  private confirmed: Alert[] = [];
  private flushing = false;
  private flushAgain = false;
  private readonly listeners = new Set<() => void>();

  private readonly retries: number;
  private readonly backoffMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly keyFactory: () => string;

  constructor(
    private readonly service: AlertsService,
    private readonly store: QueueStore,
    options: QueueOptions = {},
  ) {
    this.retries = options.retries ?? 3;
    this.backoffMs = options.backoffMs ?? 400;
    this.sleep = options.sleep ?? (ms => new Promise(r => setTimeout(r, ms)));
    this.keyFactory = options.keyFactory ?? defaultKeyFactory;
  }

  /** Load persisted ops on startup, then rebuild confirmed state from the
   *  server. An op caught mid-flight last run is reset to pending: idempotency
   *  makes re-sending it safe. Confirmed alerts are NOT persisted — they live
   *  on the server and are re-read here; offline at launch, they stay empty
   *  until the next refresh, while pending writes still show optimistically. */
  async hydrate(): Promise<void> {
    const loaded = await this.store.load();
    this.ops = loaded.map(op =>
      op.status === 'inFlight' ? {...op, status: 'pending'} : op,
    );
    await this.refresh();
  }

  /** Re-read confirmed alerts from the server. Safe to call on reconnect. */
  async refresh(): Promise<void> {
    try {
      this.confirmed = await this.service.list();
    } catch {
      // Offline: keep the last-known confirmed rather than blanking the UI.
    }
    this.emit();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  pending(): readonly WriteOp[] {
    return this.ops;
  }

  confirmedAlerts(): readonly Alert[] {
    return this.confirmed;
  }

  /** The optimistic view the UI renders. */
  projected(): ProjectedAlert[] {
    return projectAlerts(this.confirmed, this.ops);
  }

  /** Queue a new alert. Returns immediately; the caller flushes when online. */
  create(input: AlertInput): Promise<WriteOp> {
    return this.enqueue({type: 'create', input});
  }

  /**
   * Delete an alert by id. If the id belongs to a create that has NOT synced
   * yet, cancel it locally instead of creating-then-deleting on the server —
   * otherwise the round-trip would arm the alert and then fail to remove it
   * (the delete would target the temp key, not the real server id).
   */
  async remove(id: string): Promise<void> {
    const optimistic = this.ops.find(
      op => op.kind.type === 'create' && op.key === id,
    );
    if (optimistic) {
      this.ops = this.ops.filter(op => op !== optimistic);
      await this.persist();
      this.emit();
      return;
    }
    await this.enqueue({type: 'delete', id});
  }

  /** Queue a write. Returns immediately; the caller flushes when online. */
  async enqueue(kind: OpKind): Promise<WriteOp> {
    const op: WriteOp = {
      key: this.keyFactory(),
      kind,
      status: 'pending',
      attempts: 0,
    };
    this.ops.push(op);
    await this.persist();
    this.emit();
    return op;
  }

  /** Move a failed op back to pending so the next flush retries it. */
  async retry(key: string): Promise<void> {
    const op = this.ops.find(candidate => candidate.key === key);
    if (op && op.status === 'failed') {
      op.status = 'pending';
      op.lastError = undefined;
      await this.persist();
      this.emit();
    }
  }

  /**
   * Process every not-yet-settled op in order. A flush requested while one is
   * already running sets a flag and re-runs after — so an op enqueued mid-flush
   * is never stranded waiting for the next external trigger.
   */
  async flush(): Promise<void> {
    if (this.flushing) {
      this.flushAgain = true;
      return;
    }
    this.flushing = true;
    try {
      do {
        this.flushAgain = false;
        for (const op of [...this.ops]) {
          if (op.status === 'pending') {
            await this.process(op);
          }
        }
        // Synced ops have folded into `confirmed`; drop them from the queue.
        this.ops = this.ops.filter(op => op.status !== 'synced');
        await this.persist();
      } while (this.flushAgain);
    } finally {
      this.flushing = false;
      this.emit();
    }
  }

  private async process(op: WriteOp): Promise<void> {
    op.status = 'inFlight';
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      if (attempt > 0) {
        await this.sleep(this.backoffMs * 2 ** (attempt - 1));
      }
      op.attempts += 1;
      try {
        this.confirmed = await this.service.apply(op);
        op.status = 'synced';
        return;
      } catch (error) {
        const transient = error instanceof SyncError && error.transient;
        op.lastError = error instanceof Error ? error.message : 'sync failed';
        if (!transient || attempt === this.retries) {
          op.status = 'failed';
          return;
        }
      }
    }
  }

  private async persist(): Promise<void> {
    await this.store.save(this.ops);
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
