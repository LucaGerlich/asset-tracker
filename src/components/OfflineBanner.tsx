"use client";

import { WifiOff, Wifi } from "lucide-react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

/**
 * Displays a fixed banner at the top of the viewport to communicate
 * network status changes:
 *
 * - **Offline** : amber/yellow banner with a warning message.
 * - **Back online** : green banner that auto-dismisses after 5 seconds
 *   (handled by the useOnlineStatus hook which auto-clears wasOffline).
 */
export default function OfflineBanner() {
  const { isOnline, wasOffline } = useOnlineStatus();

  const showOffline = !isOnline;
  const showOnline = wasOffline && isOnline;

  if (!showOffline && !showOnline) {
    return null;
  }

  return (
    <output
      aria-live="polite"
      className={[
        "fixed inset-x-0 top-0 z-[9999] block px-4 py-2 text-sm font-medium",
        "transition-all duration-300 ease-in-out",
        showOffline
          ? "bg-amber-500 text-amber-950 dark:bg-amber-600 dark:text-amber-50"
          : "bg-green-500 text-green-950 dark:bg-green-600 dark:text-green-50",
      ].join(" ")}
      style={{
        animation: "slideDown 300ms ease-out forwards",
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2">
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
    </output>
  );
}
