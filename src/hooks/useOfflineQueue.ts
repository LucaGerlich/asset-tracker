"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useOnlineStatus } from "./useOnlineStatus";
import { useSession } from "@/lib/auth-client";
import {
  discardMutation,
  getQueueSnapshot,
  postToServiceWorker,
  replayQueue,
  resolveUserAnnouncement,
  type QueuedMutation,
  type ReplaySummary,
} from "@/lib/offline-queue";
import { toast } from "sonner";

interface UseOfflineQueueReturn {
  pendingCount: number;
  /** Changes the server refused. They stay until the user discards them. */
  blockedItems: QueuedMutation[];
  isSyncing: boolean;
  syncNow: () => Promise<void>;
  discard: (id: string) => Promise<void>;
}

function changes(count: number): string {
  return `${count} change${count > 1 ? "s" : ""}`;
}

function announceReplay(result: ReplaySummary): void {
  if (result.succeeded > 0) {
    toast.success(
      `Synced ${result.succeeded} offline change${result.succeeded > 1 ? "s" : ""}`,
    );
  }
  if (result.blocked > 0) {
    const verb = result.blocked > 1 ? "were" : "was";
    const pronoun = result.blocked > 1 ? "them" : "it";
    toast.warning(
      `${changes(result.blocked)} ${verb} rejected (review ${pronoun})`,
    );
  }
  if (result.dropped > 0) {
    toast.info(`${changes(result.dropped)} could no longer be applied`);
  }
  if (result.failed > 0) {
    toast.error(`${changes(result.failed)} failed to sync`);
  }
}

export function useOfflineQueue(): UseOfflineQueueReturn {
  const {
    data: session,
    isPending: sessionPending,
    error: sessionError,
  } = useSession();
  const userId = session?.user?.id ?? null;
  const [pendingCount, setPendingCount] = useState(0);
  const [blockedItems, setBlockedItems] = useState<QueuedMutation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const { isOnline, wasOffline } = useOnlineStatus();
  const syncingRef = useRef(false);

  // The service worker cannot see the session, so it learns who is signed in
  // from here and stamps that id on every change it queues. A failed session
  // lookup (offline) is not announced as a sign-out.
  const announcement = resolveUserAnnouncement({
    isPending: sessionPending,
    userId,
    error: sessionError,
  });
  const shouldAnnounce = announcement !== null;
  const announcedUserId = announcement?.userId ?? null;
  useEffect(() => {
    if (!shouldAnnounce) return;
    const announce = () => {
      void postToServiceWorker({ type: "SET_USER", userId: announcedUserId });
    };
    announce();
    // A worker that takes control later (first visit) needs telling too.
    navigator.serviceWorker?.addEventListener("controllerchange", announce);
    return () => {
      navigator.serviceWorker?.removeEventListener(
        "controllerchange",
        announce,
      );
    };
  }, [shouldAnnounce, announcedUserId]);

  const refresh = useCallback(async () => {
    if (!userId) {
      setPendingCount(0);
      setBlockedItems([]);
      return;
    }
    try {
      const snapshot = await getQueueSnapshot(userId);
      setPendingCount(snapshot.pendingCount);
      setBlockedItems(snapshot.blocked);
    } catch {
      // IndexedDB may not be available
    }
  }, [userId]);

  const syncNow = useCallback(async () => {
    if (syncingRef.current || !isOnline || !userId) return;
    syncingRef.current = true;
    setIsSyncing(true);

    try {
      announceReplay(await replayQueue(userId));
      await refresh();
    } catch (err) {
      console.error("Failed to sync offline changes", err);
      toast.error("Failed to sync offline changes");
    } finally {
      setIsSyncing(false);
      syncingRef.current = false;
    }
  }, [isOnline, userId, refresh]);

  const discard = useCallback(
    async (id: string) => {
      try {
        await discardMutation(id);
      } catch (err) {
        console.error("Failed to discard offline change", err);
        toast.error("Failed to discard the change");
      }
      await refresh();
    },
    [refresh],
  );

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
        refresh();
      }
    };
    navigator.serviceWorker?.addEventListener("message", handler);
    refresh();
    return () => {
      navigator.serviceWorker?.removeEventListener("message", handler);
    };
  }, [refresh]);

  return { pendingCount, blockedItems, isSyncing, syncNow, discard };
}
