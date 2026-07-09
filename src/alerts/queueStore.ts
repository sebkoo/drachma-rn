/**
 * Persistence seam for the write queue — the same injectable shape as the
 * rates cache's SnapshotStore: AsyncStorage on device, an in-memory map in
 * tests. Persisting the queue is what lets a write survive the user force-
 * quitting the app mid-sync; on next launch the queue is rehydrated and
 * flushed, and idempotency keys keep the replay safe.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {WriteOp} from './types';

export interface QueueStore {
  load(): Promise<WriteOp[]>;
  save(ops: WriteOp[]): Promise<void>;
}

export class AsyncStorageQueueStore implements QueueStore {
  private readonly storageKey = 'drachma.alerts.queue';

  async load(): Promise<WriteOp[]> {
    const raw = await AsyncStorage.getItem(this.storageKey);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw) as WriteOp[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return []; // corrupt queue is dropped, not crashed on
    }
  }

  async save(ops: WriteOp[]): Promise<void> {
    await AsyncStorage.setItem(this.storageKey, JSON.stringify(ops));
  }
}

export class InMemoryQueueStore implements QueueStore {
  private ops: WriteOp[] = [];

  async load(): Promise<WriteOp[]> {
    return this.ops.map(op => ({...op}));
  }

  async save(ops: WriteOp[]): Promise<void> {
    this.ops = ops.map(op => ({...op}));
  }
}
