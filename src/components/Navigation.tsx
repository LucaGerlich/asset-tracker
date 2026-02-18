"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import ThemeSwitcher from "./ThemeSwitcher";
import { SignOutButton } from "./SignOutButton";
import GlobalSearch from "./GlobalSearch";
import { ChevronDown, Menu, Search, X, Loader2, Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { NotificationIcon } from "../ui/Icons";
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

function Navigation() {
  const route = usePathname();
  const [activeMenu, setActiveMenu] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const { data: session } = useSession();

  // Notification state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!session?.user?.id) return;

    setNotificationsLoading(true);
    try {
      const response = await fetch('/api/notifications?limit=10');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setNotificationsLoading(false);
    }
  }, [session?.user?.id]);

  // Mark notification as read
  const markAsRead = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent' }),
      });
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === id ? { ...n, status: 'sent' } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Delete single notification
  const deleteNotification = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        const notification = notifications.find(n => n.id === id);
        setNotifications(prev => prev.filter(n => n.id !== id));
        if (notification?.status === 'pending') {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
        toast.success('Notification deleted');
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  // Delete all notifications
  const deleteAllNotifications = async () => {
    setDeletingAll(true);
    try {
      const response = await fetch('/api/notifications', {
        method: 'DELETE',
      });
      if (response.ok) {
        setNotifications([]);
        setUnreadCount(0);
        toast.success('All notifications deleted');
      }
    } catch (error) {
      console.error('Failed to delete all notifications:', error);
      toast.error('Failed to delete notifications');
    } finally {
      setDeletingAll(false);
    }
  };

  // Fetch notifications on mount and when session changes
  useEffect(() => {
    fetchNotifications();
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

  useEffect(() => {
    const routeSegment = route.split("/")[1];
    setActiveMenu(routeSegment);
  }, [route]);

  const isActive = (path) => {
    return activeMenu === path;
  };

  // Get user initials for avatar
  const getInitials = () => {
    if (session?.user?.firstname && session?.user?.lastname) {
      return `${session.user.firstname[0]}${session.user.lastname[0]}`.toUpperCase();
    }
    if (session?.user?.username) {
      return session.user.username.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  const userName = session?.user?.name || session?.user?.username || "User";

  return (
    <nav className="border-b">
      <div className="flex h-16 items-center px-4 md:px-6">
        <div className="flex items-center gap-6 flex-1">
          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle className="text-left">Asset Tracker</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 mt-8">
                <Link
                  href="/user"
                  className={cn(
                    "text-lg font-medium hover:text-primary transition-colors",
                    isActive("user") ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  Users
                </Link>
                <Link
                  href="/assets"
                  className={cn(
                    "text-lg font-medium hover:text-primary transition-colors",
                    isActive("assets") ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  Assets
                </Link>
                <Link
                  href="/accessories"
                  className={cn(
                    "text-lg font-medium hover:text-primary transition-colors",
                    isActive("accessories") ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  Accessories
                </Link>
                {session?.user?.isAdmin ? (
                  <Link
                    href="/admin/tickets"
                    className={cn(
                      "text-lg font-medium hover:text-primary transition-colors",
                      route.includes("/admin/tickets") || route.includes("/user/tickets") ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    Tickets
                  </Link>
                ) : (
                  <Link
                    href="/user/tickets"
                    className={cn(
                      "text-lg font-medium hover:text-primary transition-colors",
                      route.includes("/tickets") ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    My Tickets
                  </Link>
                )}
                <Separator className="my-2" />
                <p className="text-sm font-semibold text-muted-foreground">More Items</p>
                <Link
                  href="/locations"
                  className={cn(
                    "text-base font-medium hover:text-primary transition-colors pl-2",
                    isActive("locations") ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  Locations
                </Link>
                <Link
                  href="/manufacturers"
                  className={cn(
                    "text-base font-medium hover:text-primary transition-colors pl-2",
                    isActive("manufacturers") ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  Manufacturers
                </Link>
                <Link
                  href="/suppliers"
                  className={cn(
                    "text-base font-medium hover:text-primary transition-colors pl-2",
                    isActive("suppliers") ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  Suppliers
                </Link>
                <Link
                  href="/licences"
                  className={cn(
                    "text-base font-medium hover:text-primary transition-colors pl-2",
                    isActive("licences") ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  Licences
                </Link>
                <Link
                  href="/consumables"
                  className={cn(
                    "text-base font-medium hover:text-primary transition-colors pl-2",
                    isActive("consumables") ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  Consumables
                </Link>
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/dashboard" className="hidden sm:block font-bold text-lg">
            Asset Tracker
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex gap-6">
            <Link
              href="/user"
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                isActive("user") ? "text-primary" : "text-muted-foreground"
              )}
            >
              Users
            </Link>
            <Link
              href="/assets"
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                isActive("assets") ? "text-primary" : "text-muted-foreground"
              )}
            >
              Assets
            </Link>
            <Link
              href="/accessories"
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                isActive("accessories") ? "text-primary" : "text-muted-foreground"
              )}
            >
              Accessories
            </Link>
            {session?.user?.isAdmin ? (
              <Link
                href="/admin/tickets"
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  route.includes("/admin/tickets") || route.includes("/user/tickets") ? "text-primary" : "text-muted-foreground"
                )}
              >
                Tickets
              </Link>
            ) : (
              <Link
                href="/user/tickets"
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  route.includes("/tickets") ? "text-primary" : "text-muted-foreground"
                )}
              >
                My Tickets
              </Link>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  Item Menu
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[220px]">
                <DropdownMenuItem asChild>
                  <Link href="/locations">Locations</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/manufacturers">Manufacturer</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/suppliers">Supplier</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/licences">Licences</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/consumables">Consumable</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Global Search Button */}
          <Button
            variant="outline"
            className="hidden md:flex items-center gap-2 text-muted-foreground w-64"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium opacity-100 sm:flex">
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <NotificationIcon size={24} />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notifications</span>
                {notificationsLoading && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              {notifications.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {notificationsLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading notifications...
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Bell className="h-8 w-8 text-muted-foreground/50" />
                      <span>No notifications</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  {notifications.map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      className={cn(
                        "py-3 cursor-pointer flex flex-col items-start gap-1",
                        notification.status === 'pending' && "bg-muted/50"
                      )}
                      onClick={() => {
                        if (notification.status === 'pending') {
                          markAsRead(notification.id);
                        }
                      }}
                    >
                      <div className="flex w-full items-start justify-between gap-2">
                        <span className="font-medium text-sm line-clamp-1">
                          {notification.subject}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {notification.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground line-clamp-2">
                        {notification.body.replace(/<[^>]*>/g, '').slice(0, 100)}
                        {notification.body.length > 100 && '...'}
                      </span>
                      <span className="text-xs text-muted-foreground/70">
                        {new Date(notification.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </div>
              )}

              {notifications.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem
                    className="text-destructive cursor-pointer"
                    onClick={deleteAllNotifications}
                    disabled={deletingAll}
                  >
                    {deletingAll ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Delete all notifications
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <ThemeSwitcher />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarImage src="https://images.unsplash.com/broken" alt={userName} />
                  <AvatarFallback>{getInitials()}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">Signed in as</p>
                  <p className="text-xs leading-none text-muted-foreground">{userName}</p>
                  {session?.user?.email && (
                    <p className="text-xs leading-none text-muted-foreground">{session.user.email}</p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/user/${session?.user?.id || '123'}`}>My Items</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={session?.user?.isAdmin ? "/admin/tickets" : "/user/tickets"}>
                  {session?.user?.isAdmin ? "Tickets" : "My Tickets"}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/user/${session?.user?.id || '123'}/settings`}>My Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/user/${session?.user?.id || '123'}/edit`}>Edit Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <SignOutButton />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;
