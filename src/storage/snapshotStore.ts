/**
 * Storage seam for the offline cache — mirrors the injectable design of the
 * native app's actor cache: the cache logic never knows whether it's writing
 * to AsyncStorage (device) or a Map (tests).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {RatesSnapshot} from '../api/rates';

export interface SnapshotStore {
  load(key: string): Promise<RatesSnapshot | null>;
  save(key: string, snapshot: RatesSnapshot): Promise<void>;
}

export class AsyncStorageSnapshotStore implements SnapshotStore {
  private prefix = 'drachma.snapshot.';

  async load(key: string): Promise<RatesSnapshot | null> {
    const raw = await AsyncStorage.getItem(this.prefix + key);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as RatesSnapshot;
    } catch {
      return null;
    }
  }

  async save(key: string, snapshot: RatesSnapshot): Promise<void> {
    await AsyncStorage.setItem(this.prefix + key, JSON.stringify(snapshot));
  }
}

export class InMemorySnapshotStore implements SnapshotStore {
  private map = new Map<string, RatesSnapshot>();

  async load(key: string): Promise<RatesSnapshot | null> {
    return this.map.get(key) ?? null;
  }

  async save(key: string, snapshot: RatesSnapshot): Promise<void> {
    this.map.set(key, snapshot);
  }
}
