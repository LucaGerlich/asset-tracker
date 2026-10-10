import NetInfo from "@react-native-community/netinfo";
import * as api from "../api/client";
import {
  getSyncQueue,
  removeFromSyncQueue,
  incrementRetryCount,
  markSyncItemBlocked,
  setCachedAssets,
} from "./offline";

const MAX_RETRIES = 5;

type ReplayOutcome = "succeeded" | "blocked" | "dropped" | "retry";

/**
 * Same table as classifyReplayStatus in src/lib/offline-queue.ts (web).
 *
 * - 2xx: applied, remove the item.
 * - 401/403/409/422: refused but may still matter (session expired, no
 *   permission, locked organization, version conflict). Keep it, flagged
 *   `blocked`, and do not retry it.
 * - 400/404: can never apply (invalid, or its target is gone). Remove it.
 * - 429 and 5xx: temporary, retry later.
 * - Anything else is unexpected, so it is kept as blocked as well.
 */
function classifyReplayStatus(status: number): ReplayOutcome {
  if (status >= 200 && status < 300) return "succeeded";
  if (status === 400 || status === 404) return "dropped";
  if (status === 429 || status >= 500) return "retry";
  return "blocked";
}

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
    if (item.blocked) continue;

    if (item.retryCount >= MAX_RETRIES) {
      await removeFromSyncQueue(item.id);
      failed++;
      continue;
    }

    try {
      const baseUrl = await api.getServerUrl();
      const token = await api.getSessionToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Cookie"] = `better-auth.session_token=${token}`;
      }

      const response = await fetch(`${baseUrl}${item.endpoint}`, {
        method: item.method,
        headers,
        body: item.body ? JSON.stringify(item.body) : undefined,
      });

      const outcome = classifyReplayStatus(response.status);
      if (outcome === "succeeded") {
        await removeFromSyncQueue(item.id);
        processed++;
      } else if (outcome === "dropped") {
        await removeFromSyncQueue(item.id);
        failed++;
      } else if (outcome === "blocked") {
        await markSyncItemBlocked(item.id, response.status);
        failed++;
      } else if (response.status === 429) {
        // Rate limited: stop this pass, the item stays queued.
        break;
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
  unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      void processQueue();
      void syncAssets();
    }
  });

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
