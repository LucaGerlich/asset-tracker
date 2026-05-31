"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useOnlineStatus } from "./useOnlineStatus";
import {
  getPendingCount,
  replayQueue,
  type ReplayResult,
} from "@/lib/offline-queue";
import { toast } from "sonner";

interface UseOfflineQueueReturn {
  pendingCount: number;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
}

export function useOfflineQueue(): UseOfflineQueueReturn {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const { isOnline, wasOffline } = useOnlineStatus();
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      // IndexedDB may not be available
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (syncingRef.current || !isOnline) return;
    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const result: ReplayResult = await replayQueue();
      if (result.succeeded > 0) {
        toast.success(
          `Synced ${result.succeeded} offline change${result.succeeded > 1 ? "s" : ""}`,
        );
      }
      if (result.failed > 0) {
        toast.error(
          `${result.failed} change${result.failed > 1 ? "s" : ""} failed to sync`,
        );
      }
      await refreshCount();
    } catch (err) {
      console.error("Failed to sync offline changes", err);
      toast.error("Failed to sync offline changes");
    } finally {
      setIsSyncing(false);
      syncingRef.current = false;
    }
  }, [isOnline, refreshCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && wasOffline) {
      syncNow();
    }
  }, [isOnline, wasOffline, syncNow]);

  // Listen for service worker messages about queued mutations
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "MUTATION_QUEUED") {
        refreshCount();
      }
    };
    navigator.serviceWorker?.addEventListener("message", handler);
    refreshCount();
    return () => {
      navigator.serviceWorker?.removeEventListener("message", handler);
    };
  }, [refreshCount]);

  return { pendingCount, isSyncing, syncNow };
}
