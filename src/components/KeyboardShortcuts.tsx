"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const shortcuts = [
  { keys: ["Ctrl/Cmd", "K"], description: "Focus search" },
  { keys: ["?"], description: "Show keyboard shortcuts" },
  { keys: ["g", "d"], description: "Go to Dashboard" },
  { keys: ["g", "a"], description: "Go to Assets" },
  { keys: ["g", "u"], description: "Go to Users" },
  { keys: ["g", "c"], description: "Go to Consumables" },
  { keys: ["Esc"], description: "Close dialog" },
];

function ShortcutKey({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 text-xs font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

export default function KeyboardShortcuts() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const pendingKeyRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPending = useCallback(() => {
    pendingKeyRef.current = null;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    function isInputFocused() {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      if ((el as HTMLElement).isContentEditable) return true;
      return false;
    }

    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+K / Cmd+K: Focus search input
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLElement>(
          "[data-search-input]"
        );
        if (searchInput) {
          searchInput.focus();
        }
        return;
      }

      // Escape: Close any open dialog (handled natively by Radix, but also close ours)
      if (e.key === "Escape") {
        if (dialogOpen) {
          setDialogOpen(false);
        }
        return;
      }

      // Skip remaining shortcuts if user is typing in an input
      if (isInputFocused()) return;

      // ? key: Show shortcuts help
      if (e.key === "?") {
        e.preventDefault();
        setDialogOpen((prev) => !prev);
        return;
      }

      // Two-key "g then X" sequences
      if (e.key === "g" && !pendingKeyRef.current) {
        pendingKeyRef.current = "g";
        timeoutRef.current = setTimeout(clearPending, 1000);
        return;
      }

      if (pendingKeyRef.current === "g") {
        clearPending();
        switch (e.key) {
          case "d":
            router.push("/dashboard");
            break;
          case "a":
            router.push("/assets");
            break;
          case "u":
            router.push("/user");
            break;
          case "c":
            router.push("/consumables");
            break;
          default:
            break;
        }
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [router, dialogOpen, clearPending]);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Available keyboard shortcuts for quick navigation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.description}
              className="flex items-center justify-between"
            >
              <span className="text-sm text-foreground">
                {shortcut.description}
              </span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, i) => (
                  <span key={key} className="flex items-center gap-1">
                    {i > 0 && (
                      <span className="text-xs text-muted-foreground">
                        then
                      </span>
                    )}
                    <ShortcutKey>{key}</ShortcutKey>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
