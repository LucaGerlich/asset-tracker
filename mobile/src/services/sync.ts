import NetInfo from '@react-native-community/netinfo';
import * as api from '../api/client';
import {
  getSyncQueue,
  removeFromSyncQueue,
  incrementRetryCount,
  setCachedAssets,
} from './offline';

const MAX_RETRIES = 5;

/**
 * Sync service that processes queued offline mutations when the device
 * regains network connectivity, and refreshes the local asset cache.
 */

export async function processQueue(): Promise<{
  processed: number;
  failed: number;
}> {
  const networkState = await NetInfo.fetch();
  if (!networkState.isConnected) {
    return { processed: 0, failed: 0 };
  }

  const queue = await getSyncQueue();
  let processed = 0;
  let failed = 0;

  for (const item of queue) {
    if (item.retryCount >= MAX_RETRIES) {
      await removeFromSyncQueue(item.id);
      failed++;
      continue;
    }

    try {
      const baseUrl = await api.getServerUrl();
      const token = await api.getSessionToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Cookie'] = `better-auth.session_token=${token}`;
      }

      const response = await fetch(`${baseUrl}${item.endpoint}`, {
        method: item.method,
        headers,
        body: item.body ? JSON.stringify(item.body) : undefined,
      });

      if (response.ok) {
        await removeFromSyncQueue(item.id);
        processed++;
      } else if (response.status >= 400 && response.status < 500) {
        // Client error – don't retry
        await removeFromSyncQueue(item.id);
        failed++;
      } else {
        await incrementRetryCount(item.id);
        failed++;
      }
    } catch {
      await incrementRetryCount(item.id);
      failed++;
    }
  }

  return { processed, failed };
}

export async function syncAssets(): Promise<void> {
  const networkState = await NetInfo.fetch();
  if (!networkState.isConnected) return;

  try {
    const { assets } = await api.getAssets({ limit: 500 });
    await setCachedAssets(assets);
  } catch {
    // Silently fail – cached data remains available
  }
}

let unsubscribe: (() => void) | null = null;
let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startBackgroundSync(intervalMs = 60_000): void {
  // Process queue whenever connectivity changes
  unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      void processQueue();
      void syncAssets();
    }
  });

  // Periodic sync
  syncInterval = setInterval(() => {
    void processQueue();
    void syncAssets();
  }, intervalMs);
}

export function stopBackgroundSync(): void {
  unsubscribe?.();
  unsubscribe = null;
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
