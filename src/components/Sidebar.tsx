"use client";

import React, { useEffect, useMemo, useState, useLayoutEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  PanelLeftClose,
  PanelRightOpen,
  ChevronDown,
  ChevronsUpDown,
  LogOut,
  Settings,
  User,
  Bell,
  Boxes,
} from "lucide-react";
import { PlusIcon as SidebarPlusIcon } from "../ui/Icons";
import SearchTypeahead from "./SearchTypeahead";
import { useSession, signOut, type SessionUser } from "@/lib/auth-client";
import {
  navSections,
  isActivePath,
  filterSectionsForUser,
} from "@/lib/nav-config";
import { cn } from "@/lib/utils";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const Sidebar = ({ initialCollapsed = false }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;
  const isAdmin = !!user?.isadmin;

  const filteredSections = useMemo(
    () => filterSectionsForUser(navSections, isAdmin),
    [isAdmin],
  );

  useIsomorphicLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("sidebar:collapsed");
    if (stored !== null) {
      const storedCollapsed = stored === "true";
      setCollapsed((prev) =>
        prev === storedCollapsed ? prev : storedCollapsed,
      );
    } else {
      window.localStorage.setItem(
        "sidebar:collapsed",
        String(initialCollapsed),
      );
    }
  }, [initialCollapsed]);

  const activeMap = useMemo(() => {
    const map = new Map<string, boolean>();
    filteredSections.forEach((section) => {
      section.items.forEach((item) => {
        map.set(item.href, isActivePath(pathname, item.href, item.exact));
      });
    });
    return map;
  }, [pathname, filteredSections]);

  const userInitials = user
    ? `${(user.firstname || "")[0] || ""}${(user.lastname || "")[0] || ""}`.toUpperCase() ||
      "U"
    : "U";

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <TooltipProvider>
      <aside
        role="navigation"
        aria-label="Main navigation"
        className={cn(
          "border-border bg-card/80 hidden border-r backdrop-blur-sm transition-[width] duration-300 ease-in-out lg:flex lg:flex-col",
          collapsed ? "w-16" : "w-64",
        )}
      >
        {/* ─── Header: App identity ─── */}
        <div className="flex h-14 shrink-0 items-center gap-2 px-3">
          <div className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
            <Boxes className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-1 items-center justify-between">
              <Link href="/dashboard" className="flex flex-col leading-tight">
                <span className="text-sm font-semibold">Asset Tracker</span>
                <span className="text-muted-foreground text-[10px]">
                  {isAdmin ? "Admin" : "Workspace"}
                </span>
              </Link>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCollapsed((prev) => {
                    const next = !prev;
                    if (typeof window !== "undefined") {
                      window.localStorage.setItem(
                        "sidebar:collapsed",
                        String(next),
                      );
                      document.cookie = `sidebar_collapsed=${next}; path=/; max-age=31536000`;
                    }
                    return next;
                  });
                }}
                aria-label="Collapse sidebar"
                className="h-7 w-7 p-0"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
          )}
          {collapsed && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setCollapsed(false);
                if (typeof window !== "undefined") {
                  window.localStorage.setItem("sidebar:collapsed", "false");
                  document.cookie =
                    "sidebar_collapsed=false; path=/; max-age=31536000";
                }
              }}
              aria-label="Expand sidebar"
              className="h-7 w-7 p-0"
            >
              <PanelRightOpen className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <Separator className="mx-3 w-auto" />

        {/* ─── Search ─── */}
        {!collapsed && (
          <div className="px-3 py-2">
            <SearchTypeahead />
          </div>
        )}

        {/* ─── Navigation groups ─── */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {filteredSections.map((section) => {
            const hasActiveChild = section.items.some((item) =>
              activeMap.get(item.href),
            );

            const renderItems = () => (
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeMap.get(item.href);
                  const linkClasses = cn(
                    "group flex items-center gap-3 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    collapsed && "justify-center px-2",
                    active
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
                  );
                  const content = (
                    <Link href={item.href} className={linkClasses}>
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {!collapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </Link>
                  );

                  if (collapsed) {
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>{content}</TooltipTrigger>
                        <TooltipContent side="right">
                          <p>{item.label}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return (
                    <React.Fragment key={item.href}>{content}</React.Fragment>
                  );
                })}
              </div>
            );

            if (section.collapsible && !collapsed) {
              return (
                <Collapsible
                  key={section.title}
                  defaultOpen={hasActiveChild}
                  className="mb-2"
                >
                  <CollapsibleTrigger className="group text-muted-foreground hover:text-foreground flex w-full items-center justify-between px-2.5 py-1.5 text-xs font-medium tracking-wide uppercase transition-colors">
                    {section.title}
                    <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>{renderItems()}</CollapsibleContent>
                </Collapsible>
              );
            }

            return (
              <div key={section.title} className="mb-2">
                {!collapsed && (
                  <p className="text-muted-foreground px-2.5 py-1.5 text-xs font-medium tracking-wide uppercase">
                    {section.title}
                  </p>
                )}
                {renderItems()}
              </div>
            );
          })}
        </div>

        {/* ─── Quick action ─── */}
        {!collapsed && (
          <div className="px-3 pb-2">
            <Button asChild size="sm" className="w-full">
              <Link href="/assets/create">
                <SidebarPlusIcon className="mr-2 h-4 w-4" />
                Create Asset
              </Link>
            </Button>
          </div>
        )}

        <Separator className="mx-3 w-auto" />

        {/* ─── Footer: User dropdown (shadcn style) ─── */}
        <div className="p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "hover:bg-accent flex w-full items-center gap-2 rounded-md p-2 text-left transition-colors",
                  collapsed && "justify-center",
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <>
                    <div className="flex-1 truncate">
                      <p className="truncate text-sm font-medium">
                        {user?.firstname} {user?.lastname}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {user?.email}
                      </p>
                    </div>
                    <ChevronsUpDown className="text-muted-foreground h-4 w-4 shrink-0" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side={collapsed ? "right" : "top"}
              className="w-56"
            >
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">
                  {user?.firstname} {user?.lastname}
                </p>
                <p className="text-muted-foreground text-xs">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/user/${user?.id}/settings`}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/user/${user?.id}`}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/user/tickets">
                  <Bell className="mr-2 h-4 w-4" />
                  My Tickets
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </TooltipProvider>
  );
};

export default Sidebar;
