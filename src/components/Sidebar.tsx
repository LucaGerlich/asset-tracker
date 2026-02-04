"use client";

import React, { useEffect, useMemo, useState, useLayoutEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  Users,
  Boxes,
  Puzzle,
  ClipboardList,
  Factory,
  Truck,
  MapPin,
  BadgeCheck,
  PanelLeftClose,
  PanelRightOpen,
  Ticket,
} from "lucide-react";
import { PlusIcon as SidebarPlusIcon } from "../ui/Icons";

const navSections = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard, exact: true },
      { label: "Users", href: "/user", icon: Users },
      { label: "Assets", href: "/assets", icon: Boxes },
      { label: "Accessories", href: "/accessories", icon: Puzzle },
    ],
  },
  {
    title: "Inventory",
    items: [
      { label: "Consumables", href: "/consumables", icon: ClipboardList },
      { label: "Licences", href: "/licences", icon: BadgeCheck },
      { label: "Manufacturers", href: "/manufacturers", icon: Factory },
      { label: "Suppliers", href: "/suppliers", icon: Truck },
      { label: "Locations", href: "/locations", icon: MapPin },
    ],
  },
  {
    title: "Support",
    items: [
      { label: "IT Tickets", href: "/tickets", icon: Ticket },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Reports", href: "/reports", icon: LayoutDashboard },
      { label: "Admin Settings", href: "/admin/settings", icon: LayoutDashboard, adminOnly: true },
    ],
  },
];

const cx = (...classes) => classes.filter(Boolean).join(" ");

function isActivePath(pathname, href, exact = false) {
  if (exact) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const Sidebar = ({ initialCollapsed = false }) => {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  useIsomorphicLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("sidebar:collapsed");
    if (stored !== null) {
      const storedCollapsed = stored === "true";
      setCollapsed((prev) => (prev === storedCollapsed ? prev : storedCollapsed));
    } else {
      window.localStorage.setItem("sidebar:collapsed", String(initialCollapsed));
    }
  }, [initialCollapsed]);

  const activeMap = useMemo(() => {
    const map = new Map();
    navSections.forEach((section) => {
      section.items.forEach((item) => {
        map.set(item.href, isActivePath(pathname, item.href, item.exact));
      });
    });
    return map;
  }, [pathname]);

  return (
    <TooltipProvider>
      <aside
        className={cx(
          "hidden border-r border-default-200 bg-content1/60 backdrop-blur lg:flex lg:flex-col transition-[width] duration-300 ease-in-out",
          collapsed ? "w-20" : "w-64"
        )}
      >
      <div className="flex h-16 shrink-0 items-center justify-between px-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
          <span className={cx("text-lg tracking-tight", collapsed && "sr-only")}>Asset Tracker</span>
        </Link>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setCollapsed((prev) => {
              const next = !prev;
              if (typeof window !== "undefined") {
                window.localStorage.setItem("sidebar:collapsed", String(next));
                document.cookie = `sidebar_collapsed=${next}; path=/; max-age=31536000`;
              }
              return next;
            });
          }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="h-8 w-8 p-0"
        >
          {collapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>
      <div className="flex-1 px-2 py-4 scroll-shadow">
        {navSections.map((section) => (
          <div key={section.title} className="mb-6">
            {!collapsed && (
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">
                {section.title}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = activeMap.get(item.href);
                const linkClasses = cx(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  collapsed && "justify-center px-2",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-foreground-500 hover:bg-content2 hover:text-foreground"
                );
                const content = (
                  <Link href={item.href} className={linkClasses}>
                    <Icon className="h-5 w-5 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>
                        {content}
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{item.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return <React.Fragment key={item.href}>{content}</React.Fragment>;
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="p-3">
          <p className={cx("text-xs text-foreground-400", collapsed && "sr-only")}>Quick actions</p>
          <div className="mt-2 flex items-center gap-2">
            <Button
              asChild
              size="sm"
              className="w-full"
            >
              <Link href="/assets/create">
                <SidebarPlusIcon className="h-4 w-4 mr-2" />
                <span className={collapsed ? "sr-only" : "inline"}>Create Asset</span>
              </Link>
            </Button>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
};

export default Sidebar;
