/**
 * Rate alerts — the app's first WRITE path. "Tell me when USD/KRW crosses X."
 *
 * Writes are the hard half of a mobile app on a flaky network: the tap happens
 * offline, the request may be sent twice, the ack may be lost. These types
 * carry the two things that make writes safe — a client-owned idempotency key
 * and an explicit per-op status — so the queue (writeQueue.ts) can retry
 * without ever double-applying and the UI can show the truth optimistically.
 */

export type Direction = 'above' | 'below';

/** A confirmed alert, as the server (mock) knows it. */
export interface Alert {
  id: string;
  from: string;
  to: string;
  threshold: number;
  direction: Direction;
}

/** What the user asked for, before it has a server id. */
export interface AlertInput {
  from: string;
  to: string;
  threshold: number;
  direction: Direction;
}

export type OpKind =
  | {type: 'create'; input: AlertInput}
  | {type: 'delete'; id: string};

export type OpStatus = 'pending' | 'inFlight' | 'synced' | 'failed';

/**
 * A write in the queue. `key` is the idempotency key: stable across every
 * retry of the SAME intent, so the server can dedupe. It is generated once,
 * when the op is created, and never changes.
 */
export interface WriteOp {
  key: string;
  kind: OpKind;
  status: OpStatus;
  attempts: number;
  lastError?: string;
}

/** A failure the queue knows how to reason about: retry only if transient. */
export class SyncError extends Error {
  constructor(
    message: string,
    readonly transient: boolean,
  ) {
    super(message);
    this.name = 'SyncError';
  }
}
