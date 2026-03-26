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
      {
        label: "Licence Categories",
        href: "/licenceCategories",
        icon: FolderKey,
      },
      { label: "Models", href: "/models", icon: Tags },
      { label: "Status Types", href: "/statusTypes", icon: CircleDot },
    ],
  },
  {
    title: "Tools",
    items: [
      { label: "Advanced Search", href: "/search", icon: Filter },
      { label: "IT Tickets", href: "/tickets", icon: Ticket },
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
