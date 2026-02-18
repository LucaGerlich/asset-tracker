"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface OnlineStatus {
  isOnline: boolean;
  wasOffline: boolean;
}

/**
 * Tracks browser online/offline status.
 *
 * - `isOnline` reflects `navigator.onLine` and updates on `online`/`offline` events.
 * - `wasOffline` is `true` for 5 seconds after the connection is restored,
 *   allowing the UI to show a "back online" message before it disappears.
 */
export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);
  const wasOfflineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    setWasOffline(true);

    // Clear any existing timer so we don't get stale resets
    if (wasOfflineTimerRef.current) {
      clearTimeout(wasOfflineTimerRef.current);
    }

    wasOfflineTimerRef.current = setTimeout(() => {
      setWasOffline(false);
      wasOfflineTimerRef.current = null;
    }, 5_000);
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);

    // If a "wasOffline" timer is running, cancel it — we're offline again
    if (wasOfflineTimerRef.current) {
      clearTimeout(wasOfflineTimerRef.current);
      wasOfflineTimerRef.current = null;
    }
    setWasOffline(false);
  }, []);

  useEffect(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);

      if (wasOfflineTimerRef.current) {
        clearTimeout(wasOfflineTimerRef.current);
      }
    };
  }, [handleOnline, handleOffline]);

  return { isOnline, wasOffline };
}
