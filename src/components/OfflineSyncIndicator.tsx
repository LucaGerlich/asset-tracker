"use client";

import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import type { QueuedMutation } from "@/lib/offline-queue";
import { CloudUpload, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function pathOf(url: string): string {
  try {
    const { pathname, search } = new URL(url, window.location.origin);
    return `${pathname}${search}`;
  } catch {
    return url;
  }
}

function describeStatus(item: QueuedMutation): string {
  return item.lastStatus ? `${item.lastStatus}` : "Not sent";
}

interface BlockedChangesProps {
  items: QueuedMutation[];
  onDiscard: (id: string) => Promise<void>;
}

function BlockedChanges({ items, onDiscard }: BlockedChangesProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="bg-warning-bg text-warning-foreground hover:bg-warning-bg/80 gap-1.5 text-xs"
        >
          <TriangleAlert className="h-3.5 w-3.5" />
          {items.length} need review
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)]">
        <p className="text-sm font-medium">Changes the server rejected</p>
        <p className="text-muted-foreground mt-1 text-xs">
          These were made offline and were not applied. Discard each one once
          you have checked it, then repeat it if you still need it.
        </p>
        <ul className="mt-3 max-h-72 space-y-3 overflow-y-auto">
          {items.map((item) => (
            <li
              key={item.id}
              className="border-border flex items-start justify-between gap-3 border-t pt-3 first:border-t-0 first:pt-0"
            >
              <div className="min-w-0 text-xs">
                <p className="truncate font-medium">
                  {item.method} {pathOf(item.url)}
                </p>
                <p className="text-muted-foreground">
                  {describeStatus(item)}
                  {item.lastError ? `: ${item.lastError}` : ""}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 text-xs"
                onClick={() => void onDiscard(item.id)}
              >
                Discard
              </Button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export default function OfflineSyncIndicator() {
  const { pendingCount, blockedItems, isSyncing, syncNow, discard } =
    useOfflineQueue();

  const showPending = pendingCount > 0 || isSyncing;
  if (!showPending && blockedItems.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {showPending && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground gap-1.5 text-xs"
          onClick={syncNow}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CloudUpload className="h-3.5 w-3.5" />
          )}
          {isSyncing ? "Syncing…" : `${pendingCount} pending`}
        </Button>
      )}
      {blockedItems.length > 0 && (
        <BlockedChanges items={blockedItems} onDiscard={discard} />
      )}
    </div>
  );
}
