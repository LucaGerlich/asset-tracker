import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Asset, SyncQueueItem } from '../types';

const ASSETS_CACHE_KEY = '@offline_assets';
const SYNC_QUEUE_KEY = '@sync_queue';
const LAST_SYNC_KEY = '@last_sync_timestamp';

/**
 * Offline storage service for caching data locally and queuing
 * mutations to be synced when connectivity is restored.
 */

// ── Asset cache ──────────────────────────────────────────────────────

export async function getCachedAssets(): Promise<Asset[]> {
  const data = await AsyncStorage.getItem(ASSETS_CACHE_KEY);
  return data ? (JSON.parse(data) as Asset[]) : [];
}

export async function setCachedAssets(assets: Asset[]): Promise<void> {
  await AsyncStorage.setItem(ASSETS_CACHE_KEY, JSON.stringify(assets));
  await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
}

export async function getCachedAssetById(
  id: string,
): Promise<Asset | undefined> {
  const assets = await getCachedAssets();
  return assets.find((a) => a.id === id);
}

export async function getLastSyncTimestamp(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_SYNC_KEY);
}

// ── Sync queue ───────────────────────────────────────────────────────

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const data = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
  return data ? (JSON.parse(data) as SyncQueueItem[]) : [];
}

export async function addToSyncQueue(
  item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retryCount'>,
): Promise<void> {
  const queue = await getSyncQueue();
  const newItem: SyncQueueItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };
  queue.push(newItem);
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

export async function removeFromSyncQueue(id: string): Promise<void> {
  const queue = await getSyncQueue();
  const filtered = queue.filter((item) => item.id !== id);
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
}

export async function incrementRetryCount(id: string): Promise<void> {
  const queue = await getSyncQueue();
  const item = queue.find((q) => q.id === id);
  if (item) {
    item.retryCount += 1;
  }
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

export async function clearSyncQueue(): Promise<void> {
  await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
}

// ── Generic cache helpers ────────────────────────────────────────────

export async function cacheData(
  key: string,
  data: unknown,
): Promise<void> {
  await AsyncStorage.setItem(
    `@cache_${key}`,
    JSON.stringify({ data, timestamp: Date.now() }),
  );
}

export async function getCachedData<T>(
  key: string,
  maxAgeMs = 5 * 60 * 1000,
): Promise<T | null> {
  const raw = await AsyncStorage.getItem(`@cache_${key}`);
  if (!raw) return null;

  const parsed = JSON.parse(raw) as { data: T; timestamp: number };
  if (Date.now() - parsed.timestamp > maxAgeMs) {
    await AsyncStorage.removeItem(`@cache_${key}`);
    return null;
  }

  return parsed.data;
}

export async function clearAllCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter(
    (k) => k.startsWith('@cache_') || k === ASSETS_CACHE_KEY,
  );
  await AsyncStorage.multiRemove(cacheKeys);
}
