"use client";

import { useState, useEffect } from "react";
import { Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DismissibleHelpTipProps {
  id: string;
  children: React.ReactNode;
}

export default function DismissibleHelpTip({
  id,
  children,
}: DismissibleHelpTipProps) {
  const [dismissed, setDismissed] = useState(true); // hidden by default until loaded
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Check local preferences for dismissed state
    fetch("/api/user/preferences")
      .then((res) => res.json())
      .then((prefs) => {
        const dismissedIds: string[] = prefs.helpDismissed || [];
        setDismissed(dismissedIds.includes(id));
      })
      .catch(() => {
        setDismissed(false);
      })
      .finally(() => setLoaded(true));
  }, [id]);

  const handleDismiss = async () => {
    setDismissed(true);
    try {
      const res = await fetch("/api/user/preferences");
      const prefs = await res.json();
      const current: string[] = prefs.helpDismissed || [];
      if (!current.includes(id)) {
        await fetch("/api/user/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ helpDismissed: [...current, id] }),
        });
      }
    } catch {
      // Non-critical
    }
  };

  if (!loaded || dismissed) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
      <div className="flex-1 text-sm text-blue-800 dark:text-blue-200">
        {children}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 shrink-0 p-0 text-blue-600 hover:text-blue-800 dark:text-blue-400"
        onClick={handleDismiss}
        aria-label="Dismiss tip"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
