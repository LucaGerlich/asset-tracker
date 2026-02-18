"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

/**
 * Displays a fixed banner at the top of the viewport to communicate
 * network status changes:
 *
 * - **Offline** : amber/yellow banner with a warning message.
 * - **Back online** : green banner that auto-dismisses after 3 seconds.
 */
export default function OfflineBanner() {
  const { isOnline, wasOffline } = useOnlineStatus();
  const [showBackOnline, setShowBackOnline] = useState(false);

  // When wasOffline becomes true (user just reconnected), show the green banner
  // for 3 seconds then hide it.
  useEffect(() => {
    if (wasOffline && isOnline) {
      setShowBackOnline(true);
      const timer = setTimeout(() => {
        setShowBackOnline(false);
      }, 3_000);
      return () => clearTimeout(timer);
    }
    // If the user goes offline again, dismiss the back-online banner immediately
    if (!isOnline) {
      setShowBackOnline(false);
    }
  }, [wasOffline, isOnline]);

  const showOffline = !isOnline;
  const showOnline = isOnline && showBackOnline;

  if (!showOffline && !showOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "fixed top-0 inset-x-0 z-[9999] px-4 py-2 text-sm font-medium",
        "transition-all duration-300 ease-in-out",
        showOffline
          ? "bg-amber-500 dark:bg-amber-600 text-amber-950 dark:text-amber-50"
          : "bg-green-500 dark:bg-green-600 text-green-950 dark:text-green-50",
      ].join(" ")}
      style={{
        animation: "slideDown 300ms ease-out forwards",
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
        {showOffline ? (
          <>
            <WifiOff className="h-4 w-4 flex-shrink-0" />
            <span>
              You are currently offline. Some features may be unavailable.
            </span>
          </>
        ) : (
          <>
            <Wifi className="h-4 w-4 flex-shrink-0" />
            <span>Back online</span>
          </>
        )}
      </div>

      {/* Inline keyframes so we don't need a global CSS change */}
      <style>{`
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
