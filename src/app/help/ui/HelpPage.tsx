"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Search } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
  links?: Array<{ label: string; href: string }>;
}

interface FAQSection {
  title: string;
  description: string;
  adminOnly?: boolean;
  items: FAQItem[];
}

const FAQ_SECTIONS: FAQSection[] = [
  {
    title: "Getting Started",
    description: "Basics of using Asset Tracker",
    items: [
      {
        question: "What is Asset Tracker?",
        answer:
          "Asset Tracker is a self-hosted IT asset management platform. It helps you track hardware, software licences, accessories, consumables, and components across your organization with full lifecycle management, depreciation tracking, and automated reporting.",
      },
      {
        question: "What should I do first after logging in?",
        answer:
          "Start by exploring the Dashboard for an overview. If you're an admin, head to Admin Settings to configure your organization, set up categories, and optionally connect Microsoft Intune for automatic device import. Then create your first asset from the Quick Create button in the sidebar.",
        links: [
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin Settings", href: "/admin/settings" },
        ],
      },
      {
        question: "What's the difference between admin and regular users?",
        answer:
          "Admins can manage all assets, users, and settings. Regular users see only their assigned assets, can submit requests for items, create support tickets, and manage their own profile. Role-based access control (RBAC) allows fine-grained permission configuration.",
      },
      {
        question: "How do I customize my dashboard?",
        answer:
          "Click the + button on the dashboard to add widgets. You can drag and drop widgets to reorder them, or remove widgets you don't need. Available widgets include Stats, Asset Map, Fleet Value, TCO, Health Score, and more.",
        links: [{ label: "Dashboard", href: "/dashboard" }],
      },
    ],
  },
  {
    title: "Assets",
    description: "Managing hardware and equipment",
    items: [
      {
        question: "How do I create an asset?",
        answer:
          "Use the Quick Create button in the sidebar or navigate to Assets and click 'Create Asset'. Fill in the name, asset tag, serial number, and optionally set category, manufacturer, model, location, and purchase details. You can also use Asset Templates to pre-fill common configurations.",
        links: [
          { label: "Create Asset", href: "/assets/create" },
          { label: "Assets List", href: "/assets" },
        ],
      },
      {
        question: "What is the Asset Health Score?",
        answer:
          "The health score is a composite 0-100 rating based on four equally-weighted factors: Age (how close to end-of-life), Warranty (active/expiring/expired), Maintenance (on schedule or overdue), and Depreciation (current book value). A score of 80+ is 'excellent', 60+ is 'good', 40+ is 'fair', 20+ is 'poor', and below 20 is 'critical'. Assets missing data get a neutral score for those factors.",
      },
      {
        question: "How does depreciation work?",
        answer:
          "Depreciation is calculated per asset category. Go to Admin Settings > Depreciation to configure the method (straight-line, declining balance, or sum-of-years), useful life, and salvage percentage for each category. The current value and accumulated depreciation are shown on each asset's detail page and in the Fleet Value widget.",
        links: [{ label: "Admin Settings", href: "/admin/settings" }],
      },
      {
        question: "How do I use QR codes?",
        answer:
          "Each asset has a unique QR code. Print QR labels from Admin Settings > Labels. Scan QR codes using the Scanner page to quickly look up assets, check them out, or view details. The scanner works on all modern browsers using the device camera.",
        links: [{ label: "Scanner", href: "/scanner" }],
      },
      {
        question: "Can I import assets in bulk?",
        answer:
          "Yes. Go to Import, select the entity type (assets, accessories, consumables, licences, or users), upload a CSV file, and map columns. The import handles errors per-row so one bad row doesn't stop the entire import.",
        links: [{ label: "Bulk Import", href: "/import" }],
      },
    ],
  },
  {
    title: "Inventory",
    description: "Accessories, consumables, components, and licences",
    items: [
      {
        question:
          "What's the difference between assets, accessories, consumables, and components?",
        answer:
          "Assets are tracked individually with unique serial numbers (laptops, monitors). Accessories are items assigned to users (headsets, keyboards). Consumables are quantity-tracked items that get used up (toner, cables). Components are parts that go into assets (RAM, SSDs). Licences track software with seat management.",
      },
      {
        question: "How do stock alerts work?",
        answer:
          "Set a minimum quantity on consumables and components. When stock falls below the threshold, the system generates alerts visible on the dashboard and optionally sends email notifications if configured.",
      },
      {
        question: "How do I manage software licences?",
        answer:
          "Create a licence with the key, seat count, and expiration date. Assign seats to users from the licence detail page. The dashboard shows licences expiring within 90 days. You can export licence data for compliance audits.",
        links: [{ label: "Licences", href: "/licences" }],
      },
    ],
  },
  {
    title: "Requests & Reservations",
    description: "Requesting and reserving items",
    items: [
      {
        question: "How do I request an item?",
        answer:
          "Navigate to any requestable asset, accessory, consumable, or licence and click 'Request'. Your request goes to admins for approval. You'll receive an email notification when it's approved or rejected.",
      },
      {
        question: "How does the approval flow work?",
        answer:
          "When a user submits a request, all admins in the organization are notified. Any admin can approve or reject the request from the Approvals page. On approval, the item is automatically assigned to the requester.",
        links: [{ label: "Approvals", href: "/approvals" }],
      },
      {
        question: "How do I return an item?",
        answer:
          "Go to your assigned items (visible on your profile or dashboard). Click the Return button. An admin will confirm the return, and the item becomes available again.",
      },
      {
        question: "What is the booking calendar?",
        answer:
          "The Reservations page shows a month-view calendar with all asset reservations. Green bars are approved, yellow are pending, and red are rejected. Click any day to create a new reservation.",
        links: [{ label: "Reservations", href: "/reservations" }],
      },
    ],
  },
  {
    title: "Reports & Analytics",
    description: "Data insights and exports",
    items: [
      {
        question: "What reports are available?",
        answer:
          "The Reports page has tabs for Overview (charts), Utilization, Trends, Breakdown, Warranty, Depreciation, Advanced analytics, and TCO (Total Cost of Ownership). Each tab shows different visualizations of your asset data.",
        links: [{ label: "Reports", href: "/reports" }],
      },
      {
        question: "What is TCO (Total Cost of Ownership)?",
        answer:
          "TCO aggregates all costs: purchase price + maintenance actual costs + software licence costs, broken down by category. It answers 'how much does our laptop fleet actually cost us?' beyond just the sticker price.",
      },
      {
        question: "How do I export data?",
        answer:
          "Use the Export button on list pages to download CSV or XLSX files. For depreciation specifically, export from /api/export?entity=depreciation&format=xlsx for accounting-friendly columns including current book value, accumulated depreciation, and depreciation method.",
      },
      {
        question: "Can I get reports automatically via email?",
        answer:
          "Yes. Go to your user Settings > Report Subscriptions. Add a subscription choosing the report type (Summary, Depreciation, Warranty, or TCO), frequency (daily, weekly, or monthly), and format (CSV or XLSX). Reports are generated and emailed automatically at 7 AM UTC.",
      },
    ],
  },
  {
    title: "Administration",
    description: "User management, roles, and settings",
    adminOnly: true,
    items: [
      {
        question: "How do I add a new user?",
        answer:
          "Go to Users and click 'Create User'. Choose a password mode: manual (set password), generate (random password emailed), or invite (magic link emailed). You can also import users via CSV or sync from LDAP/Active Directory.",
        links: [{ label: "Create User", href: "/user/create" }],
      },
      {
        question: "How do roles and permissions work?",
        answer:
          "Create roles in Admin Settings > Roles with specific permissions (e.g., asset:view, asset:create, license:manage). Assign roles to users from their edit page. Users inherit all permissions from their assigned roles. The default fallback allows basic access when no roles are configured.",
        links: [{ label: "Roles", href: "/admin/settings" }],
      },
      {
        question: "What are temporary access grants?",
        answer:
          "Set an 'Access Expires' date on any user account. The system automatically deactivates the user when the date passes, sends warning emails at 7 days and 1 day before expiry, and notifies org admins. Perfect for contractors or temporary staff.",
      },
      {
        question: "How do I configure email notifications?",
        answer:
          "Go to Admin Settings > Email. Choose a provider (Brevo, SendGrid, Mailgun, Postmark, or AWS SES), enter your API key, and configure the from address. Test the connection before saving. Notifications are queued and processed daily at 2 AM UTC.",
        links: [{ label: "Email Settings", href: "/admin/settings" }],
      },
      {
        question: "What maintenance and cron jobs run automatically?",
        answer:
          "The system runs 10 daily cron jobs: demo reset (midnight), session cleanup (1 AM), notifications (2 AM), workflow automation (3 AM), GDPR retention (4 AM), LDAP sync (5 AM), cache cleanup (6 AM), scheduled reports (7 AM), access expiry (7:30 AM), and Intune sync (8 AM). All times are UTC.",
      },
    ],
  },
  {
    title: "Integrations",
    description: "External service connections",
    adminOnly: true,
    items: [
      {
        question: "How do I connect Microsoft Intune?",
        answer:
          "1. In Azure Portal, create an App Registration. 2. Add the Graph API permission 'DeviceManagementManagedDevices.Read.All' (Application type). 3. Grant admin consent. 4. Create a client secret. 5. In Asset Tracker, go to Admin Settings > Intune, enter Tenant ID, Client ID, and Client Secret. 6. Click Test Connection to verify. 7. Click Sync Now to import devices.",
        links: [{ label: "Intune Settings", href: "/admin/settings" }],
      },
      {
        question: "What happens during an Intune sync?",
        answer:
          "The sync fetches all managed devices from Intune, matches them to existing assets by Intune device ID or serial number, and creates/updates assets. Manufacturers, models, and categories (iPhone, iPad, Mac, Windows Laptop, etc.) are auto-created. Devices not found in your system are created as new assets with an INT- tag prefix.",
      },
      {
        question: "How do I set up LDAP/Active Directory sync?",
        answer:
          "Go to Admin Settings > LDAP. Enter your server URL, port, bind credentials, and search base. Configure attribute mapping for username, email, first/last name. Enable auto-sync for scheduled user imports. Test the connection before saving.",
        links: [{ label: "LDAP Settings", href: "/admin/settings" }],
      },
      {
        question: "How do webhooks work?",
        answer:
          "Configure webhooks in Admin Settings > Webhooks. Choose which events to subscribe to (asset created, user updated, Intune sync completed, etc.). Webhook payloads are signed with HMAC-SHA256 for verification. Failed deliveries retry with exponential backoff.",
        links: [{ label: "Webhook Settings", href: "/admin/settings" }],
      },
    ],
  },
  {
    title: "Keyboard Shortcuts",
    description: "Navigate faster with keyboard",
    items: [
      {
        question: "What keyboard shortcuts are available?",
        answer:
          "Press ? anywhere to see the shortcuts dialog. Available shortcuts: Ctrl/Cmd+K (focus search), g then d (go to Dashboard), g then a (go to Assets), g then u (go to Users), g then c (go to Consumables), Esc (close dialog).",
      },
    ],
  },
  {
    title: "Glossary",
    description: "Key terms and definitions",
    items: [
      {
        question: "Asset",
        answer:
          "A trackable physical item with a unique serial number and asset tag. Examples: laptops, monitors, servers, phones.",
      },
      {
        question: "Accessory",
        answer:
          "An item assigned to users but not individually serialized. Examples: keyboards, mice, headsets.",
      },
      {
        question: "Consumable",
        answer:
          "A quantity-tracked item that gets used up over time. Examples: toner cartridges, cables, batteries.",
      },
      {
        question: "Component",
        answer:
          "A part that goes into an asset. Tracked by quantity with check-in/check-out to specific assets. Examples: RAM modules, SSDs, power supplies.",
      },
      {
        question: "Kit",
        answer:
          "A pre-defined bundle of assets, accessories, and consumables. Used for standardized onboarding packages like 'New Employee Kit'.",
      },
      {
        question: "Depreciation",
        answer:
          "The decrease in an asset's value over time. Calculated using straight-line, declining balance, or sum-of-years methods based on purchase price, useful life, and salvage value.",
      },
      {
        question: "TCO (Total Cost of Ownership)",
        answer:
          "The complete cost of owning an asset including purchase price, maintenance costs, and associated licence costs.",
      },
      {
        question: "Health Score",
        answer:
          "A 0-100 composite score indicating an asset's overall condition based on age, warranty status, maintenance recency, and depreciation percentage.",
      },
      {
        question: "RBAC (Role-Based Access Control)",
        answer:
          "A permissions system where users are assigned roles, and each role has specific permissions (e.g., asset:view, asset:create). Users can have multiple roles.",
      },
      {
        question: "MDM (Mobile Device Management)",
        answer:
          "Software for managing mobile devices and computers in an organization. Asset Tracker integrates with Microsoft Intune to auto-import managed devices.",
      },
    ],
  },
];

export default function HelpPage({ isAdmin }: { isAdmin: boolean }) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSections = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return FAQ_SECTIONS.filter((section) => {
      // Filter admin-only sections for non-admins
      if (section.adminOnly && !isAdmin) return false;
      return true;
    })
      .map((section) => {
        if (!query) return section;

        const filteredItems = section.items.filter(
          (item) =>
            item.question.toLowerCase().includes(query) ||
            item.answer.toLowerCase().includes(query),
        );

        return { ...section, items: filteredItems };
      })
      .filter((section) => !query || section.items.length > 0);
  }, [searchQuery, isAdmin]);

  const totalItems = filteredSections.reduce(
    (sum, s) => sum + s.items.length,
    0,
  );

  return (
    <div className="mx-auto max-w-3xl pb-12">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Help & FAQ</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Find answers to common questions about Asset Tracker
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          type="search"
          placeholder="Search help topics..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <p className="text-muted-foreground mt-1.5 text-xs">
            {totalItems} result{totalItems !== 1 ? "s" : ""} found
          </p>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {filteredSections.map((section) => (
          <div key={section.title}>
            <div className="mb-3">
              <h2 className="text-base font-semibold">{section.title}</h2>
              <p className="text-muted-foreground text-xs">
                {section.description}
              </p>
            </div>

            <div className="border-default-200 divide-y rounded-lg border">
              {section.items.map((item) => (
                <Collapsible key={item.question}>
                  <CollapsibleTrigger className="group hover:bg-accent/50 flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium transition-colors">
                    {item.question}
                    <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t px-4 py-3">
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {item.answer}
                      </p>
                      {item.links && item.links.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.links.map((link) => (
                            <Link
                              key={link.href}
                              href={link.href}
                              className="text-primary text-xs font-medium hover:underline"
                            >
                              {link.label} &rarr;
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-default-200 mt-8 rounded-lg border p-4 text-center">
        <p className="text-sm font-medium">Still need help?</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Create a support ticket and we&apos;ll get back to you.
        </p>
        <Link
          href="/tickets"
          className="text-primary mt-2 inline-block text-sm font-medium hover:underline"
        >
          Create Ticket &rarr;
        </Link>
      </div>
    </div>
  );
}
