"use client";

import {
  useEffect,
  useState,
  useCallback,
  useOptimistic,
  useTransition,
} from "react";
import Link from "next/link";
import { useSession, type SessionUser } from "@/lib/auth-client";
import ThemeSwitcher from "./ThemeSwitcher";
// User menu moved to sidebar
import GlobalSearch from "./GlobalSearch";
import { Search, X, Loader2, Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// NotificationIcon replaced with lucide Bell
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: string;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
}

function formatTimeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function Navigation() {
  const [searchOpen, setSearchOpen] = useState(false);
  const { data: session } = useSession();
  const _user = session?.user as SessionUser | undefined;

  // Notification state — single source of truth so list and badge stay atomic
  type NotifState = {
    notifications: Notification[];
    unreadCount: number;
  };

  type OptimisticAction =
    | { type: "markRead"; id: string }
    | { type: "markAllReadDisplayed" }
    | { type: "delete"; id: string }
    | { type: "deleteAll" };

  const [state, setState] = useState<NotifState>({
    notifications: [],
    unreadCount: 0,
  });
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [optimisticState, applyOptimistic] = useOptimistic<
    NotifState,
    OptimisticAction
  >(state, (current, action): NotifState => {
    switch (action.type) {
      case "markRead": {
        const target = current.notifications.find((n) => n.id === action.id);
        const wasUnread = target?.status === "pending";
        return {
          notifications: current.notifications.map((n) =>
            n.id === action.id ? { ...n, status: "sent" } : n,
          ),
          unreadCount: wasUnread
            ? Math.max(0, current.unreadCount - 1)
            : current.unreadCount,
        };
      }
      case "markAllReadDisplayed": {
        const displayedPending = current.notifications.filter(
          (n) => n.status === "pending",
        ).length;
        return {
          notifications: current.notifications.map((n) =>
            n.status === "pending" ? { ...n, status: "sent" } : n,
          ),
          unreadCount: Math.max(0, current.unreadCount - displayedPending),
        };
      }
      case "delete": {
        const target = current.notifications.find((n) => n.id === action.id);
        const wasUnread = target?.status === "pending";
        return {
          notifications: current.notifications.filter(
            (n) => n.id !== action.id,
          ),
          unreadCount: wasUnread
            ? Math.max(0, current.unreadCount - 1)
            : current.unreadCount,
        };
      }
      case "deleteAll":
        return { notifications: [], unreadCount: 0 };
    }
  });

  // Fetch notifications (server is source of truth; replaces both list + count)
  const fetchNotifications = useCallback(async () => {
    if (!session?.user?.id) return;

    setNotificationsLoading(true);
    try {
      const response = await fetch("/api/notifications?limit=10");
      if (response.ok) {
        const data = await response.json();
        setState({
          notifications: data.notifications || [],
          unreadCount: data.unreadCount || 0,
        });
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setNotificationsLoading(false);
    }
  }, [session?.user?.id]);

  // Mark notification as read — optimistic
  const markAsRead = (id: string) => {
    startTransition(async () => {
      applyOptimistic({ type: "markRead", id });
      try {
        const response = await fetch(`/api/notifications/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "sent" }),
        });
        if (!response.ok) throw new Error("Request failed");
        setState((prev) => {
          const target = prev.notifications.find((n) => n.id === id);
          const wasUnread = target?.status === "pending";
          return {
            notifications: prev.notifications.map((n) =>
              n.id === id ? { ...n, status: "sent" } : n,
            ),
            unreadCount: wasUnread
              ? Math.max(0, prev.unreadCount - 1)
              : prev.unreadCount,
          };
        });
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
        toast.error("Couldn't mark as read");
        // Optimistic update auto-reverts when this transition ends
      }
    });
  };

  // Mark every displayed pending notification as read — single optimistic
  // update + parallel PATCH requests. unreadCount drops by the displayed
  // pending count (not to 0) since there may be more unread beyond limit=10.
  const markAllReadDisplayed = () => {
    const pendingIds = state.notifications
      .filter((n) => n.status === "pending")
      .map((n) => n.id);
    if (pendingIds.length === 0) return;

    startTransition(async () => {
      applyOptimistic({ type: "markAllReadDisplayed" });
      const results = await Promise.allSettled(
        pendingIds.map((id) =>
          fetch(`/api/notifications/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "sent" }),
          }),
        ),
      );
      const failed = results.filter(
        (r) =>
          r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok),
      ).length;
      if (failed > 0) {
        toast.error(
          `Couldn't mark ${failed} notification${
            failed === 1 ? "" : "s"
          } as read`,
        );
        // Reconcile partial-success state with server truth
        fetchNotifications();
      } else {
        setState((prev) => {
          const displayedPending = prev.notifications.filter(
            (n) => n.status === "pending",
          ).length;
          return {
            notifications: prev.notifications.map((n) =>
              n.status === "pending" ? { ...n, status: "sent" } : n,
            ),
            unreadCount: Math.max(0, prev.unreadCount - displayedPending),
          };
        });
      }
    });
  };

  const deleteNotification = (id: string) => {
    startTransition(async () => {
      applyOptimistic({ type: "delete", id });
      try {
        const response = await fetch(`/api/notifications/${id}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Request failed");
        setState((prev) => {
          const target = prev.notifications.find((n) => n.id === id);
          const wasUnread = target?.status === "pending";
          return {
            notifications: prev.notifications.filter((n) => n.id !== id),
            unreadCount: wasUnread
              ? Math.max(0, prev.unreadCount - 1)
              : prev.unreadCount,
          };
        });
        toast.success("Notification deleted");
      } catch (error) {
        console.error("Failed to delete notification:", error);
        toast.error("Failed to delete notification");
      }
    });
  };

  const deleteAllNotifications = () => {
    startTransition(async () => {
      applyOptimistic({ type: "deleteAll" });
      try {
        const response = await fetch("/api/notifications", {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Request failed");
        setState({ notifications: [], unreadCount: 0 });
        toast.success("All notifications deleted");
      } catch (error) {
        console.error("Failed to delete all notifications:", error);
        toast.error("Failed to delete notifications");
      }
    });
  };

  useEffect(() => {
    fetchNotifications();

    const POLL_INTERVAL = 30_000;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (!intervalId) {
        intervalId = setInterval(fetchNotifications, POLL_INTERVAL);
      }
    };
    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    // Pause polling when the tab is hidden to save requests
    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchNotifications();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchNotifications]);

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <nav className="border-border/60 bg-background/95 border-b backdrop-blur-sm">
      <div className="flex h-16 items-center px-4 md:px-6">
        <div className="flex flex-1 items-center gap-4">
          <Link href="/dashboard" className="text-lg font-bold">
            Asset Tracker
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* Global Search Button */}
          <Button
            variant="outline"
            className="text-muted-foreground hidden w-64 items-center gap-2 md:flex"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="bg-muted pointer-events-none hidden h-5 items-center gap-1 rounded border px-1.5 font-mono text-xs font-medium opacity-100 select-none sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-5 w-5" />
          </Button>

          <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

          <DropdownMenu
            onOpenChange={(open) => {
              if (open) fetchNotifications();
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {optimisticState.unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                    {optimisticState.unreadCount > 99
                      ? "99+"
                      : optimisticState.unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-96">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm font-semibold">Notifications</span>
                <div className="flex items-center gap-1">
                  {optimisticState.unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground h-7 text-xs"
                      onClick={markAllReadDisplayed}
                    >
                      Mark all read
                    </Button>
                  )}
                  {notificationsLoading && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                </div>
              </div>
              <DropdownMenuSeparator />

              {optimisticState.notifications.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center text-sm">
                  <Bell className="text-muted-foreground/30 mx-auto mb-2 h-8 w-8" />
                  <p>All caught up</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  {optimisticState.notifications.map((notification) => {
                    const isUnread = notification.status === "pending";
                    const timeAgo = formatTimeAgo(notification.createdAt);
                    return (
                      <div
                        key={notification.id}
                        className={cn(
                          "group flex gap-3 border-b px-3 py-2.5 last:border-0",
                          isUnread && "bg-primary/5",
                        )}
                      >
                        <div className="mt-1.5 shrink-0">
                          {isUnread ? (
                            <span className="bg-primary block h-2 w-2 rounded-full" />
                          ) : (
                            <span className="block h-2 w-2" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "text-sm leading-snug",
                              isUnread && "font-medium",
                            )}
                          >
                            {notification.subject}
                          </p>
                          <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-relaxed">
                            {notification.body
                              .replace(/<[^>]*>/g, "")
                              .slice(0, 120)}
                          </p>
                          <p className="text-muted-foreground/60 mt-1 text-[11px]">
                            {timeAgo}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-start gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          {isUnread && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              title="Mark as read"
                              onClick={() => markAsRead(notification.id)}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive h-6 w-6"
                            title="Dismiss"
                            onClick={() => deleteNotification(notification.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {optimisticState.notifications.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-muted-foreground cursor-pointer justify-center text-xs"
                    onClick={deleteAllNotifications}
                    disabled={isPending}
                  >
                    {isPending ? (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : null}
                    Delete all notifications
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <ThemeSwitcher />
        </div>
      </div>
    </nav>
  );
}

export default Navigation;
