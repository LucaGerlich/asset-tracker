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
  Cpu,
  Package,
  SearchCheck,
  Filter,
  CalendarDays,
  HelpCircle,
  Copy,
  ShoppingCart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  adminOnly?: boolean;
}

export interface NavSection {
  title: string;
  collapsible?: boolean;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        exact: true,
      },
      { label: "Users", href: "/user", icon: Users, adminOnly: true },
      { label: "Assets", href: "/assets", icon: Boxes },
      { label: "Accessories", href: "/accessories", icon: Puzzle },
    ],
  },
  {
    title: "Inventory",
    items: [
      { label: "Consumables", href: "/consumables", icon: ClipboardList },
      { label: "Components", href: "/components", icon: Cpu, adminOnly: true },
      { label: "Licences", href: "/licences", icon: BadgeCheck },
      {
        label: "Manufacturers",
        href: "/manufacturers",
        icon: Factory,
        adminOnly: true,
      },
      {
        label: "Suppliers",
        href: "/suppliers",
        icon: Truck,
        adminOnly: true,
      },
      {
        label: "Locations",
        href: "/locations",
        icon: MapPin,
        adminOnly: true,
      },
    ],
  },
  {
    title: "Categories",
    collapsible: true,
    items: [
      {
        label: "Asset Categories",
        href: "/assetCategories",
        icon: Layers,
        adminOnly: true,
      },
      {
        label: "Accessory Categories",
        href: "/accessoryCategories",
        icon: FolderOpen,
        adminOnly: true,
      },
      {
        label: "Consumable Categories",
        href: "/consumableCategories",
        icon: FolderCog,
        adminOnly: true,
      },
      {
        label: "Component Categories",
        href: "/componentCategories",
        icon: Cpu,
        adminOnly: true,
      },
      {
        label: "Licence Categories",
        href: "/licenceCategories",
        icon: FolderKey,
        adminOnly: true,
      },
      { label: "Models", href: "/models", icon: Tags, adminOnly: true },
      {
        label: "Status Types",
        href: "/statusTypes",
        icon: CircleDot,
        adminOnly: true,
      },
    ],
  },
  {
    title: "Tools",
    items: [
      { label: "Advanced Search", href: "/search", icon: Filter },
      { label: "IT Tickets", href: "/tickets", icon: Ticket },
      {
        label: "Maintenance",
        href: "/maintenance",
        icon: Wrench,
        adminOnly: true,
      },
      { label: "Kits", href: "/kits", icon: Package, adminOnly: true },
      { label: "Audits", href: "/audits", icon: SearchCheck, adminOnly: true },
      { label: "Reservations", href: "/reservations", icon: CalendarDays },
      {
        label: "Approvals",
        href: "/approvals",
        icon: ClipboardCheck,
        adminOnly: true,
      },
      {
        label: "Procurement",
        href: "/procurement",
        icon: ShoppingCart,
        adminOnly: true,
      },
      { label: "QR Scanner", href: "/scanner", icon: QrCode },
      { label: "Import", href: "/import", icon: Upload, adminOnly: true },
      {
        label: "Duplicates",
        href: "/duplicates",
        icon: Copy,
        adminOnly: true,
      },
      { label: "Help", href: "/help", icon: HelpCircle },
    ],
  },
  {
    title: "Administration",
    collapsible: true,
    items: [
      { label: "Reports", href: "/reports", icon: BarChart3, adminOnly: true },
      {
        label: "TCO Analysis",
        href: "/tco",
        icon: BarChart3,
        adminOnly: true,
      },
      {
        label: "Workflows",
        href: "/admin/workflows",
        icon: Zap,
        adminOnly: true,
      },
      { label: "API Docs", href: "/api-docs", icon: FileJson, adminOnly: true },
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

export const primaryNavItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  { label: "Assets", href: "/assets", icon: Boxes },
  { label: "Users", href: "/user", icon: Users },
  { label: "Consumables", href: "/consumables", icon: Package },
];

export function isActivePath(pathname: string, href: string, exact = false) {
  if (exact) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function filterSectionsForUser(
  sections: NavSection[],
  isAdmin: boolean,
): NavSection[] {
  if (isAdmin) return sections;
  return sections.reduce<NavSection[]>((acc, section) => {
    if (!section.items.some((item) => item.adminOnly)) {
      acc.push(section);
      return acc;
    }
    const filtered = section.items.filter((item) => !item.adminOnly);
    if (filtered.length > 0) acc.push({ ...section, items: filtered });
    return acc;
  }, []);
}
