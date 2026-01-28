"use client";

/**
 * Demo Banner Component
 * Displays a banner indicating this is a demo environment
 * Only shown when DEMO_MODE environment variable is set to "true"
 */

import { useState } from "react";
import { X, Info } from "lucide-react";

interface DemoBannerProps {
  isDemo?: boolean;
}

export default function DemoBanner({ isDemo }: DemoBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Don't render if not in demo mode or banner was dismissed
  if (!isDemo || dismissed) {
    return null;
  }

  return (
    <div className="bg-amber-500 dark:bg-amber-600 text-amber-950 dark:text-amber-50 px-4 py-2 text-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <Info className="h-4 w-4 flex-shrink-0" />
          <p className="flex-1">
            <strong>Demo Mode</strong> — This is a demonstration environment. Data resets every 30 minutes.
            <span className="hidden sm:inline">
              {" "}Login: <code className="bg-amber-400/50 dark:bg-amber-700/50 px-1 rounded text-xs">demo_admin</code> / <code className="bg-amber-400/50 dark:bg-amber-700/50 px-1 rounded text-xs">demo123</code>
            </span>
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-amber-400/50 dark:hover:bg-amber-700/50 rounded transition-colors flex-shrink-0"
          aria-label="Dismiss demo banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
