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
  UsersRound,
  Boxes,
  Puzzle,
  ClipboardList,
  Factory,
  Truck,
  MapPin,
  BadgeCheck,
  PanelLeftClose,
  PanelRightOpen,
  Layers,
  FolderOpen,
  FolderCog,
  FolderKey,
  Tags,
  CircleDot,
  Ticket,
  FileJson,
  ClipboardCheck,
  QrCode,
  Upload,
  Wrench,
  Settings,
  Zap,
  Shield,
  ShieldCheck,
  BarChart3,
  FileSearch,
  ChevronDown,
  Cpu,
  Package,
  SearchCheck,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { PlusIcon as SidebarPlusIcon } from "../ui/Icons";
import SearchTypeahead from "./SearchTypeahead";

const navSections = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
      { label: "Users", href: "/user", icon: Users },
      { label: "Assets", href: "/assets", icon: Boxes },
      { label: "Accessories", href: "/accessories", icon: Puzzle },
    ],
  },
  {
    title: "Inventory",
    items: [
      { label: "Consumables", href: "/consumables", icon: ClipboardList },
      { label: "Components", href: "/components", icon: Cpu },
      { label: "Licences", href: "/licences", icon: BadgeCheck },
      { label: "Manufacturers", href: "/manufacturers", icon: Factory },
      { label: "Suppliers", href: "/suppliers", icon: Truck },
      { label: "Locations", href: "/locations", icon: MapPin },
    ],
  },
  {
    title: "Categories",
    collapsible: true,
    items: [
      { label: "Asset Categories", href: "/assetCategories", icon: Layers },
      {
        label: "Accessory Categories",
        href: "/accessoryCategories",
        icon: FolderOpen,
      },
      {
        label: "Consumable Categories",
        href: "/consumableCategories",
        icon: FolderCog,
      },
      { label: "Licence Categories", href: "/licenceCategories", icon: FolderKey },
      { label: "Models", href: "/models", icon: Tags },
      { label: "Status Types", href: "/statusTypes", icon: CircleDot },
      { label: "IT Tickets", href: "/tickets", icon: Ticket },
    ],
  },
  {
    title: "Tools",
    items: [
      { label: "Maintenance", href: "/maintenance", icon: Wrench },
      { label: "Kits", href: "/kits", icon: Package },
      { label: "Audits", href: "/audits", icon: SearchCheck },
      { label: "Approvals", href: "/approvals", icon: ClipboardCheck },
      { label: "QR Scanner", href: "/scanner", icon: QrCode },
      { label: "Import", href: "/import", icon: Upload },
    ],
  },
  {
    title: "Administration",
    collapsible: true,
    items: [
      { label: "Reports", href: "/reports", icon: BarChart3 },
      {
        label: "Workflows",
        href: "/admin/workflows",
        icon: Zap,
        adminOnly: true,
      },
      { label: "API Docs", href: "/api-docs", icon: FileJson },
      {
        label: "Audit Logs",
        href: "/admin/audit-logs",
        icon: FileSearch,
        adminOnly: true,
      },
      { label: "GDPR", href: "/admin/gdpr", icon: Shield, adminOnly: true },
      {
        label: "Compliance",
        href: "/admin/compliance",
        icon: ShieldCheck,
        adminOnly: true,
      },
      { label: "Team", href: "/admin/team", icon: UsersRound, adminOnly: true },
      {
        label: "Admin Settings",
        href: "/admin/settings",
        icon: Settings,
        adminOnly: true,
      },
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
        role="navigation"
        aria-label="Main navigation"
        className={cx(
          "border-border bg-card/80 hidden border-r backdrop-blur-sm transition-[width] duration-300 ease-in-out lg:flex lg:flex-col",
          collapsed ? "w-20" : "w-64",
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-3">
          <Link
            href="/dashboard"
            className="text-foreground flex items-center gap-2 font-semibold"
          >
            <span
              className={cx("text-lg tracking-tight", collapsed && "sr-only")}
            >
              Asset Tracker
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
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="h-8 w-8 p-0"
          >
            {collapsed ? (
              <PanelRightOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>
        {!collapsed && (
          <div className="px-3 pb-2">
            <SearchTypeahead />
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-2 py-4">
          {navSections.map((section) => {
            const hasActiveChild = section.items.some((item) =>
              activeMap.get(item.href),
            );

            const renderItems = () => (
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeMap.get(item.href);
                  const linkClasses = cx(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                    collapsed && "justify-center px-2",
                    active
                      ? "bg-primary/8 text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  );
                  const content = (
                    <Link href={item.href} className={linkClasses}>
                      <Icon className="h-5 w-5 shrink-0 transition-transform duration-150 group-hover:scale-110" />
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
                  className="mb-4"
                >
                  <CollapsibleTrigger className="group text-muted-foreground/70 hover:text-muted-foreground flex w-full items-center justify-between px-3 pb-2 text-[11px] font-semibold tracking-widest uppercase transition-colors">
                    {section.title}
                    <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>{renderItems()}</CollapsibleContent>
                </Collapsible>
              );
            }

            return (
              <div key={section.title} className="mb-4">
                {!collapsed && (
                  <p className="text-muted-foreground/70 px-3 pb-2 text-[11px] font-semibold tracking-widest uppercase">
                    {section.title}
                  </p>
                )}
                {renderItems()}
              </div>
            );
          })}
        </div>
        <div className="border-t border-border/40 p-3">
          <div className="flex items-center gap-2">
            <Button asChild size="sm" className="w-full">
              <Link href="/assets/create">
                <SidebarPlusIcon className={collapsed ? "h-4 w-4" : "mr-2 h-4 w-4"} />
                <span className={collapsed ? "sr-only" : "inline"}>
                  Create Asset
                </span>
              </Link>
            </Button>
          </div>
          {!collapsed && (
            <p className="mt-3 text-center text-[10px] text-muted-foreground/50">
              &copy; {new Date().getFullYear()} Asset Tracker
            </p>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
};

export default Sidebar;
