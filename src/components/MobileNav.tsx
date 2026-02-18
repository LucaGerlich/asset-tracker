"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  Users,
  Package,
  Menu,
  Puzzle,
  ClipboardList,
  BadgeCheck,
  Factory,
  Truck,
  MapPin,
  Layers,
  Tags,
  CircleDot,
  Ticket,
  FileJson,
  ClipboardCheck,
  QrCode,
  Zap,
  Shield,
  ShieldCheck,
  ScrollText,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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
    title: "Categories",
    items: [
      { label: "Asset Categories", href: "/assetCategories", icon: Layers },
      { label: "Accessory Categories", href: "/accessoryCategories", icon: Layers },
      { label: "Consumable Categories", href: "/consumableCategories", icon: Layers },
      { label: "Licence Categories", href: "/licenceCategories", icon: Layers },
      { label: "Models", href: "/models", icon: Tags },
      { label: "Status Types", href: "/statusTypes", icon: CircleDot },
      { label: "IT Tickets", href: "/tickets", icon: Ticket },
    ],
  },
  {
    title: "Tools",
    items: [
      { label: "Approvals", href: "/approvals", icon: ClipboardCheck },
      { label: "QR Scanner", href: "/scanner", icon: QrCode },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Reports", href: "/reports", icon: LayoutDashboard },
      { label: "Workflows", href: "/admin/workflows", icon: Zap },
      { label: "API Docs", href: "/api-docs", icon: FileJson },
      { label: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText },
      { label: "GDPR", href: "/admin/gdpr", icon: Shield },
      { label: "Compliance", href: "/admin/compliance", icon: ShieldCheck },
      { label: "Admin Settings", href: "/admin/settings", icon: LayoutDashboard },
    ],
  },
];

function isActivePath(pathname: string, href: string, exact = false) {
  if (exact) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

const primaryNavItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, exact: true },
  { label: "Assets", href: "/assets", icon: Boxes },
  { label: "Users", href: "/user", icon: Users },
  { label: "Consumables", href: "/consumables", icon: Package },
];

export default function MobileNav() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden pb-safe"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around px-1">
        {primaryNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 px-2 py-2 text-[10px] font-medium transition-colors touch-target ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "text-primary" : ""}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              className="flex flex-col items-center justify-center gap-0.5 px-2 py-2 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors touch-target"
              aria-label="Open full navigation menu"
            >
              <Menu className="h-5 w-5" />
              <span>More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] overflow-y-auto p-0">
            <SheetHeader className="px-4 pt-4 pb-2">
              <SheetTitle>Asset Tracker</SheetTitle>
            </SheetHeader>
            <div className="px-2 py-2">
              {navSections.map((section) => (
                <div key={section.title} className="mb-4">
                  <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.title}
                  </p>
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActivePath(
                        pathname,
                        item.href,
                        "exact" in item ? item.exact : false
                      );
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setSheetOpen(false)}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors touch-target ${
                            active
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-accent hover:text-foreground"
                          }`}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
