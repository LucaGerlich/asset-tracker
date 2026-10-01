# Marketing Site Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the public marketing pages (`/`, `/pricing`, `/terms`, `/privacy`, nav, footer, OG image) with the "engineered" technical design: hairline grid, mono type, lime accent, coded product mocks, schematic cells and ASCII art. Light and dark themes are equal.

**Architecture:** A `(marketing)` route group (URLs unchanged) gets a layout that provides a `.mkt` token scope, nav and footer. All visuals are React server components (JSX/SVG) that read from one typed `sample-data.ts` and one `content.ts`. The only client code is the nav (menu/scroll), the existing `ThemeSwitcher`, and a copy-command button.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4 (`@theme inline`, `@utility`), `next-themes` (`attribute="class"`), Geist Sans/Mono (already loaded), Vitest, Playwright + `@axe-core/playwright`.

**Spec:** `docs/superpowers/specs/2026-09-30-marketing-redesign-design.md` (read it before starting; it holds the validated visual decisions and token table).

## Global Constraints

- **No glow, no gradient text, no colored shadows.** Only the hairline grid, the dotted pattern and the grid's fade mask may use gradients.
- Accent is lime only (`#c6f36b` dark / `#4d7c0f` light); coral (`#ff6b7a` dark / `#c2410c` light) is **only** for error/repair/reorder states.
- Tokens live under `.mkt` / `.dark .mkt` in `src/app/globals.css`. **Never change the app's shadcn tokens** (`:root` / `.dark` blocks).
- No new runtime dependencies. No new fonts.
- No invented metrics or customer counts. Every feature claim and mono spec footer must be true in this codebase (verified values are in Task 1's `content.ts`).
- Server components by default. `"use client"` only for: `MarketingNav`, `CopyCommand`, and the existing `ThemeSwitcher`.
- Code style is whatever Prettier and ESLint enforce in this repo: 2-space indent, double quotes, and it runs on commit via husky/lint-staged. **New** files use **named exports**. TypeScript strict, no `any`.
- Decorative SVG/ASCII gets `aria-hidden="true"`; meaning lives in visible text.
- All motion is off under `prefers-reduced-motion: reduce`, and content must be visible without animation support.
- Status names in mocks are the app's real seeded names: `Active`, `Available`, `Pending`, `Out for Repair`, `Retired` (from `prisma/seed.js` `STATUS_TYPES`).
- Canonical repo: `https://github.com/LucaGerlich/asset-tracker`. The fork `luca-fitseveneleven/assetTracker` must not appear anywhere.
- Commits: `feat:` / `fix:` / `docs:` / `test:` / `chore:`, small and logical, with no Co-Authored-By and no mention of Claude. Work on branch `feat/marketing-redesign`.
- **Tailwind v4 gotcha:** the existing `@theme { --font-family-mono: … }` is v3 naming and does **not** create `font-mono` → Geist Mono. Use the new `font-mkt-mono` / `font-mkt-sans` utilities defined in Task 2.

## Review Focus

1. **Signed-in visitor opens `/`.** They must still be redirected to `/dashboard`, and `selfHosted` must still redirect to `/login` after the route-group move. The test goes in Task 2.
2. **375px viewport with the ASCII rack, the product table and the schematic SVGs.** The page must never scroll horizontally. The test goes in Task 11 (runs over all pages).
3. **Theme toggle before hydration.** `ThemeSwitcher` renders `null` until mounted, which causes nav layout shift. The nav reserves a fixed 36×36 slot. The test goes in Task 3 (toggle is present and switching changes `html.dark`).
4. **Copy button in an insecure context** (self-hosted over `http://` LAN IP → `navigator.clipboard` undefined). It must not throw, and must show a "select & copy" fallback. The test goes in Task 4 (pure helper test).
5. **Light-theme contrast of muted mono text on dotted panels and of the olive accent.** It must pass axe AA. The test goes in Task 11 (axe in both color schemes).

---

## File Structure

```
src/app/globals.css                                   MODIFY  .mkt tokens, mkt-* utilities
src/app/(marketing)/layout.tsx                        CREATE  .mkt wrapper + nav + footer
src/app/(marketing)/page.tsx                          MOVE    from src/app/page.tsx
src/app/(marketing)/pricing/{page,PricingPageClient}.tsx  MOVE + restyle
src/app/(marketing)/terms/page.tsx                    MOVE + restyle
src/app/(marketing)/privacy/page.tsx                  MOVE + restyle
src/app/opengraph-image.tsx                           MODIFY  new look (stays at root)
src/components/marketing/
  sample-data.ts            typed Nordwerk GmbH dataset (single source)
  content.ts                all marketing copy + verified spec footers + links
  __tests__/sample-data.test.ts
  __tests__/copy-command.test.ts
  primitives/Eyebrow.tsx, BlockCursor.tsx, ProductWindow.tsx,
             SchematicCell.tsx, StatusPill.tsx, CopyCommand.tsx, copy-command.ts
  schematics/Checkout.tsx, LicenseSeats.tsx, Lifecycle.tsx,
             Identity.tsx, Consumables.tsx, AuditLog.tsx
  ascii/RackIllustration.tsx, rack-art.ts
  sections/Hero.tsx, FactStrip.tsx, SchematicGrid.tsx, AsciiStatement.tsx,
           TcoPreview.tsx, DeployOptions.tsx, Faq.tsx, FinalCta.tsx
  LandingPage.tsx            REWRITE  composes sections (named export)
  MarketingNav.tsx           REWRITE  (named export)
  MarketingFooter.tsx        REWRITE  (named export)
tests/e2e/marketing.spec.ts                           CREATE
tests/e2e/accessibility.spec.ts                       MODIFY  marketing pages × themes
README.md, docs/index.html                            MODIFY  fork URLs → canonical
package.json, CHANGELOG.md                            MODIFY  version + entry
```

---

### Task 1: Sample data + content module

**Files:**

- Create: `src/components/marketing/sample-data.ts`
- Create: `src/components/marketing/content.ts`
- Test: `src/components/marketing/__tests__/sample-data.test.ts`

**Interfaces:**

- Produces: `SAMPLE_PEOPLE`, `SAMPLE_LOCATIONS`, `SAMPLE_ASSETS`, `SAMPLE_LICENSES`, `SAMPLE_CONSUMABLES`, `SAMPLE_AUDIT_EVENTS`, `SAMPLE_TCO`, `LIFECYCLE`; types `SampleStatus`, `SampleAsset`, `SamplePerson`, `SampleLocationId`, `SampleLicense`, `SampleConsumable`, `SampleAuditEvent`, `SampleTcoRow`, `Tone`. From `content.ts`: `MARKETING_LINKS`, `HERO`, `FACTS`, `FEATURES`, `FEATURE_CELLS` (keyed `checkout|licenses|lifecycle|identity|consumables|audit`), `ASCII_STATEMENT`, `TCO`, `DEPLOY`, `FINAL_CTA`, `FAQ_HEADING`.

- [ ] **Step 1: Write the failing test**

```ts
// src/components/marketing/__tests__/sample-data.test.ts
import { describe, it, expect } from "vitest";
import {
  SAMPLE_ASSETS,
  SAMPLE_PEOPLE,
  SAMPLE_LOCATIONS,
  SAMPLE_LICENSES,
  SAMPLE_CONSUMABLES,
  SAMPLE_AUDIT_EVENTS,
  LIFECYCLE,
} from "../sample-data";

const REAL_STATUSES = [
  "Active",
  "Available",
  "Pending",
  "Out for Repair",
  "Retired",
];

describe("marketing sample data", () => {
  it("has unique asset tags", () => {
    const tags = SAMPLE_ASSETS.map((a) => a.tag);
    expect(new Set(tags).size).toBe(tags.length);
  });

  it("only assigns assets to existing people and locations", () => {
    const handles = new Set(SAMPLE_PEOPLE.map((p) => p.handle));
    const locations = new Set(SAMPLE_LOCATIONS.map((l) => l.id));
    for (const asset of SAMPLE_ASSETS) {
      if (asset.assignee !== null)
        expect(handles.has(asset.assignee)).toBe(true);
      expect(locations.has(asset.location)).toBe(true);
    }
  });

  it("uses the app's real status names", () => {
    for (const asset of SAMPLE_ASSETS)
      expect(REAL_STATUSES).toContain(asset.status);
    for (const step of LIFECYCLE) expect(REAL_STATUSES).toContain(step);
  });

  it("only Active or Out for Repair assets have an assignee", () => {
    for (const asset of SAMPLE_ASSETS) {
      expect(asset.assignee !== null).toBe(
        asset.status === "Active" || asset.status === "Out for Repair",
      );
    }
  });

  it("keeps license seats and stock levels in range", () => {
    for (const l of SAMPLE_LICENSES) {
      expect(l.seatsUsed).toBeGreaterThanOrEqual(0);
      expect(l.seatsUsed).toBeLessThanOrEqual(l.seatsTotal);
    }
    for (const c of SAMPLE_CONSUMABLES) {
      expect(c.stockPercent).toBeGreaterThanOrEqual(0);
      expect(c.stockPercent).toBeLessThanOrEqual(100);
      expect(c.belowMinimum).toBe(c.stockPercent < c.minimumPercent);
    }
  });

  it("references known asset tags and people in audit events", () => {
    const tags = new Set(SAMPLE_ASSETS.map((a) => a.tag));
    const handles = new Set(SAMPLE_PEOPLE.map((p) => p.handle));
    for (const e of SAMPLE_AUDIT_EVENTS) {
      if (e.assetTag) expect(tags.has(e.assetTag)).toBe(true);
      if (e.person) expect(handles.has(e.person)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/marketing/__tests__/sample-data.test.ts`
Expected: FAIL, "Failed to resolve import ../sample-data".

- [ ] **Step 3: Write `sample-data.ts`**

```ts
// src/components/marketing/sample-data.ts
// Fictional dataset shared by every marketing mock, so tags, people and
// locations stay consistent across the page. Status names match prisma/seed.js.

export type SampleStatus =
  "Active" | "Available" | "Pending" | "Out for Repair" | "Retired";
export type SampleLocationId = "FRA-HQ" | "BER-02" | "MUC-01";
export type Tone = "default" | "accent" | "warn" | "muted";

export interface SampleLocation {
  id: SampleLocationId;
  name: string;
}
export interface SamplePerson {
  handle: string;
  name: string;
  location: SampleLocationId;
}
export interface SampleAsset {
  tag: string;
  name: string;
  status: SampleStatus;
  assignee: string | null;
  location: SampleLocationId;
}
export interface SampleLicense {
  name: string;
  seatsUsed: number;
  seatsTotal: number;
  renewsOn: string;
  daysToRenewal: number;
}
export interface SampleConsumable {
  name: string;
  stockPercent: number;
  minimumPercent: number;
  belowMinimum: boolean;
}
export interface SampleAuditEvent {
  time: string;
  action: string;
  text: string;
  assetTag: string | null;
  person: string | null;
  tone: Tone;
}
export interface SampleTcoRow {
  label: string;
  purchase: number;
  maintenance: number;
}

export const SAMPLE_COMPANY = "Nordwerk GmbH";

export const SAMPLE_LOCATIONS: readonly SampleLocation[] = [
  { id: "FRA-HQ", name: "Frankfurt HQ" },
  { id: "BER-02", name: "Berlin Office" },
  { id: "MUC-01", name: "Munich Office" },
];

export const SAMPLE_PEOPLE: readonly SamplePerson[] = [
  { handle: "m.keller", name: "Mara Keller", location: "FRA-HQ" },
  { handle: "s.weber", name: "Sven Weber", location: "BER-02" },
  { handle: "j.braun", name: "Jonas Braun", location: "MUC-01" },
  { handle: "a.yilmaz", name: "Aylin Yilmaz", location: "FRA-HQ" },
  { handle: "l.fischer", name: "Lea Fischer", location: "BER-02" },
  { handle: "t.nguyen", name: "Tuan Nguyen", location: "FRA-HQ" },
  { handle: "k.schmidt", name: "Katrin Schmidt", location: "MUC-01" },
  { handle: "r.okafor", name: "Rita Okafor", location: "FRA-HQ" },
];

export const SAMPLE_ASSETS: readonly SampleAsset[] = [
  {
    tag: "AT-00412",
    name: "MacBook Pro 14",
    status: "Active",
    assignee: "m.keller",
    location: "FRA-HQ",
  },
  {
    tag: "AT-00413",
    name: "Dell U2723QE",
    status: "Available",
    assignee: null,
    location: "FRA-HQ",
  },
  {
    tag: "AT-00417",
    name: "ThinkPad T14",
    status: "Active",
    assignee: "s.weber",
    location: "BER-02",
  },
  {
    tag: "AT-00421",
    name: "iPhone 15",
    status: "Out for Repair",
    assignee: "j.braun",
    location: "MUC-01",
  },
  {
    tag: "AT-00398",
    name: "MacBook Air 13",
    status: "Available",
    assignee: null,
    location: "MUC-01",
  },
  {
    tag: "AT-00430",
    name: "iPad Air",
    status: "Active",
    assignee: "a.yilmaz",
    location: "FRA-HQ",
  },
  {
    tag: "AT-00433",
    name: "Logitech Rally Bar",
    status: "Active",
    assignee: "l.fischer",
    location: "BER-02",
  },
  {
    tag: "AT-00441",
    name: "ThinkPad X1 Carbon",
    status: "Pending",
    assignee: null,
    location: "BER-02",
  },
  {
    tag: "AT-00302",
    name: "Dell Latitude 7420",
    status: "Retired",
    assignee: null,
    location: "FRA-HQ",
  },
  {
    tag: "AT-00445",
    name: "Pixel 8",
    status: "Active",
    assignee: "t.nguyen",
    location: "FRA-HQ",
  },
  {
    tag: "AT-00447",
    name: "Studio Display",
    status: "Active",
    assignee: "k.schmidt",
    location: "MUC-01",
  },
  {
    tag: "AT-00450",
    name: "MacBook Pro 16",
    status: "Active",
    assignee: "r.okafor",
    location: "FRA-HQ",
  },
];

export const SAMPLE_LICENSES: readonly SampleLicense[] = [
  {
    name: "Figma",
    seatsUsed: 18,
    seatsTotal: 20,
    renewsOn: "2026-11-02",
    daysToRenewal: 32,
  },
  {
    name: "Microsoft 365 E3",
    seatsUsed: 41,
    seatsTotal: 45,
    renewsOn: "2027-01-15",
    daysToRenewal: 107,
  },
  {
    name: "JetBrains All Products",
    seatsUsed: 9,
    seatsTotal: 10,
    renewsOn: "2026-12-01",
    daysToRenewal: 62,
  },
];

export const SAMPLE_CONSUMABLES: readonly SampleConsumable[] = [
  {
    name: "Toner HP 59A",
    stockPercent: 86,
    minimumPercent: 25,
    belowMinimum: false,
  },
  {
    name: "USB-C cables",
    stockPercent: 32,
    minimumPercent: 40,
    belowMinimum: true,
  },
  {
    name: "Keyboards",
    stockPercent: 100,
    minimumPercent: 20,
    belowMinimum: false,
  },
];

export const SAMPLE_AUDIT_EVENTS: readonly SampleAuditEvent[] = [
  {
    time: "14:02:11",
    action: "checkout",
    text: "AT-00412 → m.keller",
    assetTag: "AT-00412",
    person: "m.keller",
    tone: "default",
  },
  {
    time: "14:05:47",
    action: "licence.update",
    text: "Figma seats 18/20",
    assetTag: null,
    person: null,
    tone: "default",
  },
  {
    time: "14:09:03",
    action: "status",
    text: "AT-00421 Out for Repair",
    assetTag: "AT-00421",
    person: "j.braun",
    tone: "warn",
  },
  {
    time: "14:12:30",
    action: "scim.deactivate",
    text: "l.fischer",
    assetTag: null,
    person: "l.fischer",
    tone: "default",
  },
  {
    time: "14:12:58",
    action: "checkin",
    text: "AT-00398 ← k.schmidt",
    assetTag: "AT-00398",
    person: "k.schmidt",
    tone: "accent",
  },
];

// Illustrative round numbers (EUR, 3-year view) for the TCO preview.
export const SAMPLE_TCO: readonly SampleTcoRow[] = [
  { label: "Laptops", purchase: 48000, maintenance: 6200 },
  { label: "Monitors", purchase: 12000, maintenance: 900 },
  { label: "Phones", purchase: 9500, maintenance: 2100 },
  { label: "Meeting rooms", purchase: 7000, maintenance: 1400 },
];

export const LIFECYCLE: readonly SampleStatus[] = [
  "Pending",
  "Available",
  "Active",
  "Out for Repair",
  "Retired",
];
```

Note: `Out for Repair` assets keep their assignee (the repair doesn't change the owner), which is why the test allows it.

- [ ] **Step 4: Write `content.ts` (verified copy; facts checked on 2026-09-30)**

```ts
// src/components/marketing/content.ts
// All marketing copy in one place. Spec footers reference real routes/crons;
// re-verify them if the referenced code moves.

export const MARKETING_LINKS = {
  github: "https://github.com/LucaGerlich/asset-tracker",
  register: "/register",
  login: "/login",
  pricing: "/pricing",
  features: "/#features",
  terms: "/terms",
  privacy: "/privacy",
} as const;

export const HERO = {
  eyebrow: "OPEN SOURCE · MIT · SELF-HOSTABLE",
  title: "Every asset, accounted for.",
  sub: "IT asset management software for teams that track hardware, licenses, consumables and maintenance. One inventory, one audit trail, no spreadsheets.",
  primaryCta: "Start free",
  command: "docker compose up -d",
} as const;

export const FACTS = [
  "SSO · OIDC · SAML",
  "SCIM 2.0 provisioning",
  "MFA / TOTP",
  "EU-hosted or self-hosted",
] as const;

export const FEATURES = {
  eyebrow: "FEATURES",
  title: "One inventory, every workflow.",
  sub: "Drawn like a schematic, because that's how it's built.",
} as const;

export interface FeatureCellCopy {
  label: string;
  meta: string;
  title: string;
  description: string;
  footer: string;
}

export const FEATURE_CELLS = {
  checkout: {
    label: "checkout",
    meta: "AT-00412",
    title: "Check-out & check-in",
    description:
      "Assign assets to people or locations with due dates and a full return flow.",
    footer: "POST /api/asset/checkout",
  },
  licenses: {
    label: "license_seats",
    meta: "figma · 18/20",
    title: "License compliance",
    description:
      "Seats, renewals and cost per license, with alerts before anything expires.",
    footer: "cron · notifications · daily",
  },
  lifecycle: {
    label: "lifecycle",
    meta: "status transitions",
    title: "Full lifecycle",
    description:
      "From purchase to disposal, with custom statuses and allowed transitions.",
    footer: "GET /api/status-transitions",
  },
  identity: {
    label: "identity",
    meta: "SCIM 2.0",
    title: "SSO & SCIM provisioning",
    description:
      "Sign in with your identity provider. Users are created and deactivated automatically.",
    footer: "OIDC · SAML · /api/scim/v2",
  },
  consumables: {
    label: "consumables",
    meta: "stock",
    title: "Consumables & stock",
    description:
      "Minimum quantities and stock alerts, so you reorder before you run out.",
    footer: "GET /api/stock-alerts",
  },
  audit: {
    label: "audit_log",
    meta: "tail -f",
    title: "Audit trail with revert",
    description:
      "Every change with actor and timestamp, and a revert when someone gets it wrong.",
    footer: "POST /api/admin/audit-logs/:id/revert",
  },
} as const satisfies Record<string, FeatureCellCopy>;

export const ASCII_STATEMENT = {
  eyebrow: "VISIBILITY",
  title: "Know where everything is. And what state it's in.",
  body: "Every asset has an owner, a location and a status, and every change to them is recorded. When a phone goes in for repair, you know who had it, where it went and when it comes back.",
  specs: [
    "locations · nested",
    "assignees · users or places",
    "history · per asset",
  ],
} as const;

export const TCO = {
  eyebrow: "UNDERSTAND",
  title: "See what your hardware really costs.",
  body: "Purchase price, maintenance and depreciation per category, exported as CSV or XLSX for finance.",
  footer: "GET /api/export?entity=depreciation",
} as const;

export const DEPLOY = {
  eyebrow: "DEPLOY",
  title: "Your server or ours.",
  selfHost: {
    title: "Self-host",
    body: "MIT-licensed. Run it on your own hardware with Docker and PostgreSQL.",
    command:
      "git clone https://github.com/LucaGerlich/asset-tracker && docker compose up -d",
  },
  cloud: {
    title: "Cloud",
    body: "Hosted in the EU, with managed updates and backups. Start free, upgrade when you grow.",
  },
} as const;

export const FAQ_HEADING = {
  eyebrow: "FAQ",
  title: "Frequently asked questions",
} as const;

export const FINAL_CTA = {
  title: "Start tracking in minutes.",
  sub: "Free to start. No credit card required.",
} as const;
```

- [ ] **Step 5: Verify every claim that carries a ✓ still holds**

Run each command; all must print at least one match:

```bash
ls src/app/api/asset/checkout/route.ts
grep -n "expiringLicenses" src/lib/notifications.ts
grep -n '"/api/cron/notifications"' vercel.json
ls src/app/api/status-transitions/route.ts src/app/api/stock-alerts/route.ts
ls "src/app/api/admin/audit-logs/[id]/revert/route.ts"
ls src/app/api/scim/v2/Users/route.ts
grep -n '"depreciation"' src/app/api/export/route.ts
grep -n "No credit card" -r src/lib/seo.ts src/app/pricing 2>/dev/null; grep -rn "trial" src/lib/plans* 2>/dev/null | head -3
grep -rn "totp\|twoFactor" src/lib/auth.ts | head -2
ls docker-compose.yml
```

If `No credit card required` isn't backed by the signup/trial flow (the grep finds nothing), change `FINAL_CTA.sub` to `"Free to start."`. If any other command finds nothing, reword that cell's `footer` to the real route you find and note it in the commit body.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/components/marketing/__tests__/sample-data.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add src/components/marketing/sample-data.ts src/components/marketing/content.ts src/components/marketing/__tests__/sample-data.test.ts
git commit -m "feat: add typed sample data and verified copy for marketing pages"
```

---

### Task 2: Theme tokens, utilities and `(marketing)` route group

**Files:**

- Modify: `src/app/globals.css` (append; do not edit existing blocks)
- Create: `src/app/(marketing)/layout.tsx`
- Move: `src/app/page.tsx` → `src/app/(marketing)/page.tsx`; `src/app/pricing/` → `src/app/(marketing)/pricing/`; `src/app/terms/` → `src/app/(marketing)/terms/`; `src/app/privacy/` → `src/app/(marketing)/privacy/`
- Modify: the moved `terms/page.tsx`, `privacy/page.tsx` and `pricing/PricingPageClient.tsx` (remove their own `<MarketingNav />` / `<MarketingFooter />` and the imports); `components/marketing/LandingPage.tsx` (same)
- Test: `tests/e2e/marketing.spec.ts` (created here, extended in Task 11)

**Interfaces:**

- Produces Tailwind utilities: colors `bg-mkt-bg`, `bg-mkt-surface`, `bg-mkt-stage`, `border-mkt-line`, `text-mkt-text`, `text-mkt-muted`, `text-mkt-accent`, `bg-mkt-accent-fill`, `text-mkt-accent-fill-fg`, `text-mkt-warn`, `border-mkt-warn`, `border-mkt-accent`; fonts `font-mkt-sans`, `font-mkt-mono`; pattern utilities `mkt-grid`, `mkt-dots`; motion `mkt-reveal`. The layout wraps pages in `<div className="mkt …">`.
- `MarketingNav` / `MarketingFooter` are still the **old default exports** at this point; Task 3 replaces them.

- [ ] **Step 1: Write the failing E2E test for routing parity**

```ts
// tests/e2e/marketing.spec.ts
import { test, expect } from "@playwright/test";

const PAGES = ["/", "/pricing", "/terms", "/privacy"] as const;

test.describe("marketing pages (anonymous)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const path of PAGES) {
    test(`${path} renders inside the .mkt shell`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("div.mkt")).toHaveCount(1);
      await expect(page.locator("div.mkt header")).toHaveCount(1);
      await expect(page.locator("div.mkt footer")).toHaveCount(1);
    });
  }
});

test.describe("marketing pages (signed in)", () => {
  // Uses the default storageState from auth.setup.ts (signed-in user).
  test("signed-in visitor on / is redirected to /dashboard", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test tests/e2e/marketing.spec.ts --project=chromium`
Expected: the four `.mkt shell` tests FAIL (`div.mkt` count 0); the redirect test PASSES, which is the baseline we must keep.

- [ ] **Step 3: Append tokens and utilities to `globals.css`**

```css
/* ── Marketing site tokens (scoped; app tokens above stay untouched) ── */
@theme inline {
  --color-mkt-bg: var(--mkt-bg);
  --color-mkt-surface: var(--mkt-surface);
  --color-mkt-stage: var(--mkt-stage);
  --color-mkt-line: var(--mkt-line);
  --color-mkt-text: var(--mkt-text);
  --color-mkt-muted: var(--mkt-muted);
  --color-mkt-accent: var(--mkt-accent);
  --color-mkt-accent-fill: var(--mkt-accent-fill);
  --color-mkt-accent-fill-fg: var(--mkt-accent-fill-fg);
  --color-mkt-warn: var(--mkt-warn);
  --font-mkt-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mkt-mono:
    var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace;
}

.mkt {
  --mkt-bg: #fbfbfa;
  --mkt-surface: #ffffff;
  --mkt-stage: #0f0f11;
  --mkt-line: #e7e7e4;
  --mkt-text: #111113;
  --mkt-muted: #5f5f67;
  --mkt-accent: #4d7c0f;
  --mkt-accent-fill: #111113;
  --mkt-accent-fill-fg: #fbfbfa;
  --mkt-warn: #c2410c;
  /* Stage is always dark: its inner tokens use the dark palette. */
  --mkt-stage-line: #1f1f22;
  --mkt-stage-text: #ededed;
  --mkt-stage-muted: #8a8a93;
  --mkt-stage-accent: #c6f36b;
  --mkt-stage-warn: #ff6b7a;
}

.dark .mkt {
  --mkt-bg: #0b0b0c;
  --mkt-surface: #111114;
  --mkt-stage: #111114;
  --mkt-line: #1f1f22;
  --mkt-text: #ededed;
  --mkt-muted: #8a8a93;
  --mkt-accent: #c6f36b;
  --mkt-accent-fill: #c6f36b;
  --mkt-accent-fill-fg: #0b0b0c;
  --mkt-warn: #ff6b7a;
}

/* Inside the always-dark stage, remap the public tokens to the stage palette. */
.mkt .mkt-stage-scope {
  --mkt-line: var(--mkt-stage-line);
  --mkt-text: var(--mkt-stage-text);
  --mkt-muted: var(--mkt-stage-muted);
  --mkt-accent: var(--mkt-stage-accent);
  --mkt-warn: var(--mkt-stage-warn);
  --mkt-surface: var(--mkt-stage);
}

@utility mkt-grid {
  background-image:
    linear-gradient(to right, var(--mkt-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--mkt-line) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(
    ellipse 70% 60% at 50% 40%,
    #000 40%,
    transparent 100%
  );
}

@utility mkt-dots {
  background-image: radial-gradient(var(--mkt-line) 1px, transparent 1px);
  background-size: 12px 12px;
}

@utility mkt-reveal {
  @supports (animation-timeline: view()) {
    @media (prefers-reduced-motion: no-preference) {
      animation: mkt-reveal linear both;
      animation-timeline: view();
      animation-range: entry 0% entry 40%;
    }
  }
}

@keyframes mkt-reveal {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
```

Note: `--mkt-muted` in light is `#5f5f67` (darker than the spec's `#6b6b73`) so small mono text on `#fbfbfa` clears AA with margin. Update the spec's token table in the same commit.

- [ ] **Step 4: Move pages with `git mv`**

```bash
mkdir -p "src/app/(marketing)"
git mv src/app/page.tsx "src/app/(marketing)/page.tsx"
git mv src/app/pricing "src/app/(marketing)/pricing"
git mv src/app/terms "src/app/(marketing)/terms"
git mv src/app/privacy "src/app/(marketing)/privacy"
```

- [ ] **Step 5: Create the layout**

```tsx
// src/app/(marketing)/layout.tsx
import type { ReactNode } from "react";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mkt bg-mkt-bg text-mkt-text font-mkt-sans flex min-h-screen flex-col">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
```

(Next.js requires the layout's default export; this is the one allowed exception to named exports.)

- [ ] **Step 6: Remove the per-page shell**

In `(marketing)/terms/page.tsx` and `(marketing)/privacy/page.tsx`: delete the `MarketingNav` / `MarketingFooter` imports and elements, and replace the outer `<div className="bg-background flex min-h-screen flex-col">` and inner `<main className="flex-1">` with a fragment `<>…</>` (the layout provides both). Do the same in `pricing/PricingPageClient.tsx` and `src/components/marketing/LandingPage.tsx`. Keep all JSON-LD and redirect logic exactly as is.

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit && npx playwright test tests/e2e/marketing.spec.ts --project=chromium`
Expected: `tsc` clean; all 5 tests PASS (4 shell + signed-in redirect).
Also check self-hosted still redirects: `NEXT_PUBLIC_SELF_HOSTED=true` is read by `isFeatureEnabled("selfHosted")`. Confirm the flag's env name in `src/lib/feature-flags.ts`, start `npm run dev` with it set, and `curl -sI localhost:3000/ | grep -i location` shows `/login`.

- [ ] **Step 8: Commit**

```bash
git add -A src/app "src/app/(marketing)" src/components/marketing/LandingPage.tsx tests/e2e/marketing.spec.ts docs/superpowers/specs/2026-09-30-marketing-redesign-design.md
git commit -m "feat: add marketing route group with scoped theme tokens"
```

---

### Task 3: Nav and footer

**Files:**

- Rewrite: `src/components/marketing/MarketingNav.tsx` (named export `MarketingNav`)
- Rewrite: `src/components/marketing/MarketingFooter.tsx` (named export `MarketingFooter`)
- Modify: `src/app/(marketing)/layout.tsx` imports → named
- Test: `tests/e2e/marketing.spec.ts` (add tests)

**Interfaces:**

- Consumes: `MARKETING_LINKS` (Task 1); `ThemeSwitcher` default export from `@/components/ThemeSwitcher`; `version` from `package.json`.
- Produces: `export function MarketingNav(): JSX.Element`, `export function MarketingFooter(): JSX.Element`.

- [ ] **Step 1: Add failing tests**

Append to `tests/e2e/marketing.spec.ts` inside the anonymous `describe`:

```ts
test("nav links point to the right places", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Start free" })).toHaveAttribute(
    "href",
    "/register",
  );
  await expect(nav.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/login",
  );
  await expect(nav.getByRole("link", { name: "GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/LucaGerlich/asset-tracker",
  );
});

test("theme toggle switches html.dark", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const html = page.locator("html");
  const before = (await html.getAttribute("class")) ?? "";
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("button", { name: /theme/i })
    .click();
  await expect
    .poll(async () =>
      ((await html.getAttribute("class")) ?? "").includes("dark"),
    )
    .toBe(!before.includes("dark"));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test tests/e2e/marketing.spec.ts --project=chromium -g "nav links|theme toggle"`
Expected: FAIL (no nav named "Main", no "Start free").

- [ ] **Step 3: Give `ThemeSwitcher`'s button an accessible name**

In `src/components/ThemeSwitcher.tsx`, add `aria-label="Toggle theme"` to the `<Button>`. This is a harmless a11y fix that also benefits the app header.

- [ ] **Step 4: Write the nav**

```tsx
// src/components/marketing/MarketingNav.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { MARKETING_LINKS } from "./content";

const LINKS = [
  { href: MARKETING_LINKS.features, label: "Features" },
  { href: MARKETING_LINKS.pricing, label: "Pricing" },
  { href: MARKETING_LINKS.github, label: "GitHub", external: true },
] as const;

function LogoMark() {
  return (
    <span
      aria-hidden="true"
      className="border-mkt-text grid h-5 w-5 place-items-center border"
    >
      <span className="bg-mkt-accent h-2 w-2" />
    </span>
  );
}

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors ${
        scrolled
          ? "border-mkt-line bg-mkt-bg/90 backdrop-blur"
          : "border-transparent"
      }`}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
      >
        <Link
          href="/"
          className="font-mkt-mono flex items-center gap-2.5 text-sm font-medium"
        >
          <LogoMark />
          Asset Tracker
        </Link>

        <div className="font-mkt-mono hidden items-center gap-7 text-[13px] md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-mkt-muted hover:text-mkt-text transition-colors"
              {...("external" in l
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {/* Fixed slot: ThemeSwitcher renders null until mounted. */}
          <span className="inline-flex h-9 w-9 items-center justify-center">
            <ThemeSwitcher />
          </span>
          <Link
            href={MARKETING_LINKS.login}
            className="text-mkt-muted hover:text-mkt-text text-sm"
          >
            Sign in
          </Link>
          <Link
            href={MARKETING_LINKS.register}
            className="bg-mkt-accent-fill text-mkt-accent-fill-fg rounded-md px-3.5 py-1.5 text-sm font-medium"
          >
            Start free
          </Link>
        </div>

        <button
          type="button"
          className="text-mkt-muted hover:text-mkt-text p-2 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mkt-mobile-menu"
          aria-label="Toggle navigation menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div
          id="mkt-mobile-menu"
          className="border-mkt-line bg-mkt-bg border-t md:hidden"
        >
          <div className="font-mkt-mono mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 text-sm">
            {LINKS.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="text-mkt-muted py-2"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <div className="flex items-center gap-3 pt-2">
              <span className="inline-flex h-9 w-9 items-center justify-center">
                <ThemeSwitcher />
              </span>
              <Link href={MARKETING_LINKS.login} className="text-mkt-muted">
                Sign in
              </Link>
              <Link
                href={MARKETING_LINKS.register}
                className="bg-mkt-accent-fill text-mkt-accent-fill-fg ml-auto rounded-md px-3.5 py-1.5"
              >
                Start free
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
```

- [ ] **Step 5: Write the footer**

```tsx
// src/components/marketing/MarketingFooter.tsx
import Link from "next/link";
import { version } from "../../../package.json";
import { MARKETING_LINKS } from "./content";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: MARKETING_LINKS.features, label: "Features" },
      { href: MARKETING_LINKS.pricing, label: "Pricing" },
      { href: MARKETING_LINKS.github, label: "GitHub" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: MARKETING_LINKS.terms, label: "Terms" },
      { href: MARKETING_LINKS.privacy, label: "Privacy" },
    ],
  },
  {
    title: "Get started",
    links: [
      { href: MARKETING_LINKS.register, label: "Create account" },
      { href: MARKETING_LINKS.login, label: "Sign in" },
    ],
  },
] as const;

export function MarketingFooter() {
  return (
    <footer className="border-mkt-line border-t">
      <div className="border-mkt-line mx-auto grid max-w-7xl grid-cols-2 border-x md:grid-cols-4">
        <div className="border-mkt-line col-span-2 border-b p-6 md:col-span-1 md:border-r md:border-b-0">
          <p className="font-mkt-mono text-sm font-medium">Asset Tracker</p>
          <p className="text-mkt-muted mt-3 text-sm">
            Open-source IT asset management. MIT licensed.
          </p>
        </div>
        {COLUMNS.map((col, i) => (
          <div
            key={col.title}
            className={`border-mkt-line p-6 ${i < COLUMNS.length - 1 ? "md:border-r" : ""} ${i === 0 ? "border-r" : ""}`}
          >
            <p className="font-mkt-mono text-mkt-muted text-[11px] tracking-widest uppercase">
              {col.title}
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-mkt-muted hover:text-mkt-text transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-mkt-line font-mkt-mono text-mkt-muted border-t">
        <div className="mx-auto flex max-w-7xl justify-between px-6 py-4 text-[11px]">
          <span>© {new Date().getFullYear()} Asset Tracker</span>
          <span>v{version}</span>
        </div>
      </div>
    </footer>
  );
}
```

If `import { version } from "../../../package.json"` fails the type check (`resolveJsonModule`), check how the sidebar reads the version (`grep -rn "package.json" src/components | head`) and use the same mechanism.

- [ ] **Step 6: Switch the layout to named imports**

```tsx
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
```

Run `grep -rn "marketing/MarketingNav\|marketing/MarketingFooter" src` and fix any remaining default imports.

- [ ] **Step 7: Run tests**

Run: `npx tsc --noEmit && npx playwright test tests/e2e/marketing.spec.ts --project=chromium`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/marketing/MarketingNav.tsx src/components/marketing/MarketingFooter.tsx src/components/ThemeSwitcher.tsx "src/app/(marketing)/layout.tsx" tests/e2e/marketing.spec.ts
git commit -m "feat: redesign marketing nav and footer with theme toggle"
```

---

### Task 4: Primitives (Eyebrow, BlockCursor, StatusPill, ProductWindow, SchematicCell, CopyCommand)

**Files:**

- Create: `src/components/marketing/primitives/{Eyebrow,BlockCursor,StatusPill,ProductWindow,SchematicCell,CopyCommand}.tsx`, `primitives/copy-command.ts`
- Test: `src/components/marketing/__tests__/copy-command.test.ts`

**Interfaces:**

- Consumes: `SampleStatus`, `Tone` (Task 1); `FeatureCellCopy` (Task 1).
- Produces:
  - `Eyebrow({ index?: string; children: ReactNode })`: renders `[ 01 ] LABEL`
  - `BlockCursor()`
  - `StatusPill({ status: SampleStatus })`
  - `ProductWindow({ title: string; children: ReactNode; className?: string })`: always-dark stage (`mkt-stage-scope`)
  - `SchematicCell({ copy: FeatureCellCopy; children: ReactNode })`: children is the diagram
  - `copyText(text: string, clipboard: Pick<Clipboard, "writeText"> | undefined): Promise<"copied" | "unsupported" | "failed">`
  - `CopyCommand({ command: string })`

- [ ] **Step 1: Write the failing test for the clipboard helper**

```ts
// src/components/marketing/__tests__/copy-command.test.ts
import { describe, it, expect, vi } from "vitest";
import { copyText } from "../primitives/copy-command";

describe("copyText", () => {
  it("returns 'unsupported' when the Clipboard API is missing (http:// LAN)", async () => {
    await expect(copyText("docker compose up -d", undefined)).resolves.toBe(
      "unsupported",
    );
  });

  it("returns 'copied' when writeText resolves", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(copyText("x", { writeText })).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith("x");
  });

  it("returns 'failed' when permission is denied", async () => {
    const writeText = vi
      .fn()
      .mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    await expect(copyText("x", { writeText })).resolves.toBe("failed");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/marketing/__tests__/copy-command.test.ts`
Expected: FAIL (cannot resolve `../primitives/copy-command`).

- [ ] **Step 3: Implement the helper**

```ts
// src/components/marketing/primitives/copy-command.ts
export type CopyResult = "copied" | "unsupported" | "failed";

export async function copyText(
  text: string,
  clipboard: Pick<Clipboard, "writeText"> | undefined,
): Promise<CopyResult> {
  if (!clipboard) return "unsupported";
  try {
    await clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/marketing/__tests__/copy-command.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the components**

```tsx
// primitives/Eyebrow.tsx
import type { ReactNode } from "react";

export function Eyebrow({
  index,
  children,
}: {
  index?: string;
  children: ReactNode;
}) {
  return (
    <p className="font-mkt-mono text-mkt-muted text-[11px] tracking-[0.18em] uppercase">
      [ {index && <span className="text-mkt-accent">{index}</span>}
      {index && " "}
      {children} ]
    </p>
  );
}
```

```tsx
// primitives/BlockCursor.tsx
export function BlockCursor() {
  return (
    <span
      aria-hidden="true"
      className="bg-mkt-accent ml-1 inline-block h-[0.8em] w-[0.45em] translate-y-[0.06em] align-baseline"
    />
  );
}
```

```tsx
// primitives/StatusPill.tsx
import type { SampleStatus } from "../sample-data";

const TONE: Record<SampleStatus, string> = {
  Active: "border-mkt-accent text-mkt-accent",
  "Out for Repair": "border-mkt-warn text-mkt-warn",
  Available: "border-mkt-line text-mkt-text",
  Pending: "border-mkt-line text-mkt-muted",
  Retired: "border-mkt-line text-mkt-muted line-through",
};

export function StatusPill({ status }: { status: SampleStatus }) {
  return (
    <span
      className={`font-mkt-mono inline-block rounded-sm border px-1.5 py-0.5 text-[10px] tracking-wider uppercase ${TONE[status]}`}
    >
      {status}
    </span>
  );
}
```

```tsx
// primitives/ProductWindow.tsx
import type { ReactNode } from "react";

export function ProductWindow({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mkt-stage-scope bg-mkt-stage text-mkt-text border-mkt-line overflow-hidden rounded-xl border shadow-[0_1px_2px_rgba(0,0,0,.06),0_12px_32px_rgba(0,0,0,.12)] ${className}`}
    >
      <div className="border-mkt-line flex items-center gap-2 border-b px-4 py-2.5">
        <span aria-hidden="true" className="flex gap-1.5">
          <span className="bg-mkt-line h-2.5 w-2.5 rounded-full" />
          <span className="bg-mkt-line h-2.5 w-2.5 rounded-full" />
          <span className="bg-mkt-line h-2.5 w-2.5 rounded-full" />
        </span>
        <span className="font-mkt-mono text-mkt-muted ml-2 text-[11px]">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}
```

```tsx
// primitives/SchematicCell.tsx
import type { ReactNode } from "react";
import type { FeatureCellCopy } from "../content";

export function SchematicCell({
  copy,
  children,
}: {
  copy: FeatureCellCopy;
  children: ReactNode;
}) {
  return (
    <article className="flex flex-col">
      <div className="mkt-dots border-mkt-line relative h-60 overflow-hidden border-b px-5 pt-4">
        <div className="font-mkt-mono text-mkt-muted flex justify-between text-[11px]">
          <span>{copy.label}</span>
          <span>{copy.meta}</span>
        </div>
        <div
          aria-hidden="true"
          className="border-mkt-muted/60 mt-1.5 h-1.5 border-x border-b"
        />
        <div aria-hidden="true" className="mt-4">
          {children}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-semibold">{copy.title}</h3>
        <p className="text-mkt-muted mt-2 text-sm leading-relaxed">
          {copy.description}
        </p>
        <p className="font-mkt-mono text-mkt-muted mt-auto pt-4 text-[11px]">
          {copy.footer}
        </p>
      </div>
    </article>
  );
}
```

```tsx
// primitives/CopyCommand.tsx
"use client";

import { useState } from "react";
import { copyText, type CopyResult } from "./copy-command";

const LABEL: Record<CopyResult | "idle", string> = {
  idle: "copy",
  copied: "copied",
  unsupported: "select & copy",
  failed: "select & copy",
};

export function CopyCommand({ command }: { command: string }) {
  const [state, setState] = useState<CopyResult | "idle">("idle");

  return (
    <div className="border-mkt-line bg-mkt-surface font-mkt-mono inline-flex max-w-full items-center gap-3 rounded-md border py-1.5 pr-1.5 pl-3 text-[13px]">
      <code className="truncate select-all">
        <span className="text-mkt-accent" aria-hidden="true">
          ${" "}
        </span>
        {command}
      </code>
      <button
        type="button"
        onClick={async () =>
          setState(await copyText(command, navigator.clipboard))
        }
        className="border-mkt-line text-mkt-muted hover:text-mkt-text shrink-0 rounded border px-2 py-0.5 text-[11px]"
        aria-live="polite"
      >
        {LABEL[state]}
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Type check and lint**

Run: `npx tsc --noEmit && npx eslint src/components/marketing`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/marketing/primitives src/components/marketing/__tests__/copy-command.test.ts
git commit -m "feat: add marketing primitives (product window, schematic cell, copy command)"
```

---

### Task 5: The six schematics

**Files:**

- Create: `src/components/marketing/schematics/{Checkout,LicenseSeats,Lifecycle,Identity,Consumables,AuditLog}.tsx`

**Interfaces:**

- Consumes: `SAMPLE_ASSETS`, `SAMPLE_LICENSES`, `SAMPLE_CONSUMABLES`, `SAMPLE_AUDIT_EVENTS`, `LIFECYCLE` (Task 1).
- Produces: named exports `CheckoutSchematic`, `LicenseSeatsSchematic`, `LifecycleSchematic`, `IdentitySchematic`, `ConsumablesSchematic`, `AuditLogSchematic`, each with no props, rendering at most 200px tall and scaling to the width.

Colors come **only** from `currentColor` or `var(--mkt-*)`; no hex values in these files. The reference look is `.superpowers/brainstorm/48901-1790781353/content/technical-assets.html` (local).

- [ ] **Step 1: Write the HTML-based schematics**

```tsx
// schematics/Checkout.tsx
import { SAMPLE_ASSETS } from "../sample-data";

const asset = SAMPLE_ASSETS[0]; // AT-00412 → m.keller
const TARGETS = [
  { label: asset.assignee ?? "", active: true },
  { label: asset.location, active: false },
  { label: "due 2026-10-14", active: false },
];

function Pill({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`font-mkt-mono block rounded border px-2.5 py-1.5 text-[11px] ${
        active
          ? "border-mkt-accent text-mkt-accent bg-mkt-surface"
          : "border-mkt-line text-mkt-muted bg-mkt-surface"
      }`}
    >
      • {label}
    </span>
  );
}

export function CheckoutSchematic() {
  return (
    <div className="grid grid-cols-[1fr_48px_1fr] items-center">
      <Pill label={asset.name} active={false} />
      <svg viewBox="0 0 48 120" className="h-[120px] w-12" fill="none">
        <path d="M0 60 H24" stroke="var(--mkt-accent)" strokeWidth="1.5" />
        <path
          d="M24 60 V20 H48 M24 60 H48 M24 60 V100 H48"
          stroke="var(--mkt-line)"
        />
        <path d="M24 60 V20 H48" stroke="var(--mkt-accent)" strokeWidth="1.5" />
        <circle
          cx="24"
          cy="60"
          r="4"
          fill="var(--mkt-surface)"
          stroke="var(--mkt-accent)"
          strokeWidth="1.5"
        />
      </svg>
      <div className="flex flex-col gap-4">
        {TARGETS.map((t) => (
          <Pill key={t.label} {...t} />
        ))}
      </div>
    </div>
  );
}
```

```tsx
// schematics/LicenseSeats.tsx
import { SAMPLE_LICENSES } from "../sample-data";

const figma = SAMPLE_LICENSES[0];
const WINDOW_DAYS = 60;

export function LicenseSeatsSchematic() {
  const markerPct = (figma.daysToRenewal / WINDOW_DAYS) * 100;
  return (
    <div className="font-mkt-mono text-[11px]">
      <div className="text-mkt-muted flex justify-between">
        <span>seats</span>
        <span className="text-mkt-text">
          {figma.seatsUsed} / {figma.seatsTotal}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-10 gap-1">
        {Array.from({ length: figma.seatsTotal }, (_, i) => (
          <span
            key={i}
            className={`h-3 rounded-[2px] border ${i < figma.seatsUsed ? "bg-mkt-accent border-mkt-accent" : "border-mkt-line"}`}
          />
        ))}
      </div>
      <div className="relative mt-8 h-6">
        <div className="bg-mkt-line absolute inset-x-0 top-3 h-px" />
        <div
          className="bg-mkt-accent absolute top-3 left-0 h-px"
          style={{ width: `${markerPct}%` }}
        />
        <span
          className="border-mkt-accent bg-mkt-surface absolute top-1.5 h-3 w-3 -translate-x-1/2 rounded-full border"
          style={{ left: `${markerPct}%` }}
        />
        <span
          className="text-mkt-accent absolute -top-4 -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${markerPct}%` }}
        >
          renews {figma.renewsOn}
        </span>
      </div>
      <div className="text-mkt-muted flex justify-between">
        <span>today</span>
        <span>{figma.daysToRenewal}d</span>
        <span>+{WINDOW_DAYS}d</span>
      </div>
    </div>
  );
}
```

```tsx
// schematics/Consumables.tsx
import { SAMPLE_CONSUMABLES } from "../sample-data";

export function ConsumablesSchematic() {
  return (
    <ul className="font-mkt-mono flex flex-col gap-2.5 text-[11px]">
      {SAMPLE_CONSUMABLES.map((c, i) => {
        const tone = c.belowMinimum
          ? "border-mkt-warn text-mkt-warn"
          : i === 0
            ? "border-mkt-accent text-mkt-accent"
            : "border-mkt-line text-mkt-muted";
        const fill = c.belowMinimum ? "bg-mkt-warn" : "bg-mkt-accent";
        return (
          <li
            key={c.name}
            className={`bg-mkt-surface grid grid-cols-[1fr_80px_52px] items-center gap-3 rounded border px-2.5 py-2 ${tone}`}
          >
            <span className="truncate">• {c.name}</span>
            <span className="border-mkt-line relative h-2.5 rounded-[2px] border">
              <span
                className={`absolute inset-y-0 left-0 ${fill}`}
                style={{ width: `${c.stockPercent}%` }}
              />
            </span>
            <span className="text-right">
              {c.belowMinimum ? "reorder" : `${c.stockPercent}%`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
```

```tsx
// schematics/AuditLog.tsx
import { SAMPLE_AUDIT_EVENTS } from "../sample-data";

const TONE = {
  default: "text-mkt-muted",
  accent: "text-mkt-accent",
  warn: "text-mkt-warn",
  muted: "text-mkt-muted",
} as const;

export function AuditLogSchematic() {
  return (
    <ol className="font-mkt-mono flex flex-col gap-1.5 text-[11px] leading-snug">
      {SAMPLE_AUDIT_EVENTS.map((e, i) => (
        <li key={e.time} className={`truncate ${TONE[e.tone]}`}>
          <span className="opacity-70">{e.time}</span>{" "}
          <span className="text-mkt-text">{e.action}</span> {e.text}
          {i === SAMPLE_AUDIT_EVENTS.length - 1 && (
            <span className="bg-mkt-accent ml-1 inline-block h-3 w-1.5 align-middle" />
          )}
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 2: Write the SVG schematics**

```tsx
// schematics/Lifecycle.tsx
import { LIFECYCLE } from "../sample-data";

// Two rows: Pending → Available → Active (top), Out for Repair → Retired (bottom).
const POS: Record<(typeof LIFECYCLE)[number], { x: number; y: number }> = {
  Pending: { x: 4, y: 20 },
  Available: { x: 118, y: 20 },
  Active: { x: 232, y: 20 },
  "Out for Repair": { x: 118, y: 120 },
  Retired: { x: 232, y: 120 },
};
const W = 104;
const H = 26;

export function LifecycleSchematic() {
  return (
    <svg viewBox="0 0 340 160" className="h-auto w-full" fill="none">
      <path d="M108 33 H118 M222 33 H232" stroke="var(--mkt-line)" />
      <path d="M284 46 V120" stroke="var(--mkt-line)" />
      <path
        d="M284 80 H170 V120"
        stroke="var(--mkt-warn)"
        strokeDasharray="3 3"
      />
      <path
        d="M150 120 V46"
        stroke="var(--mkt-warn)"
        markerEnd="url(#lc-arrow)"
      />
      <path d="M222 133 H232" stroke="var(--mkt-line)" />
      <defs>
        <marker
          id="lc-arrow"
          viewBox="0 0 6 6"
          refX="3"
          refY="3"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0 0 L6 3 L0 6 z" fill="var(--mkt-warn)" />
        </marker>
      </defs>
      {LIFECYCLE.map((s) => {
        const p = POS[s];
        const color =
          s === "Active"
            ? "var(--mkt-accent)"
            : s === "Out for Repair"
              ? "var(--mkt-warn)"
              : "var(--mkt-line)";
        const text =
          s === "Active"
            ? "var(--mkt-accent)"
            : s === "Out for Repair"
              ? "var(--mkt-warn)"
              : "var(--mkt-muted)";
        return (
          <g key={s}>
            <rect
              x={p.x}
              y={p.y}
              width={W}
              height={H}
              rx="3"
              fill="var(--mkt-surface)"
              stroke={color}
            />
            <text
              x={p.x + W / 2}
              y={p.y + 17}
              textAnchor="middle"
              fontSize="10"
              fontFamily="var(--font-geist-mono)"
              fill={text}
            >
              {s.toUpperCase()}
            </text>
          </g>
        );
      })}
      <text
        x="176"
        y="102"
        fontSize="9"
        fontFamily="var(--font-geist-mono)"
        fill="var(--mkt-warn)"
      >
        repair done
      </text>
    </svg>
  );
}
```

```tsx
// schematics/Identity.tsx
const PROVIDERS = [
  "Entra ID",
  "Okta",
  "Google Workspace",
  "SAML 2.0",
  "OIDC",
] as const;

export function IdentitySchematic() {
  return (
    <svg viewBox="0 0 340 170" className="h-auto w-full" fill="none">
      {PROVIDERS.map((p, i) => {
        const y = 8 + i * 32;
        const active = i === 0;
        const stroke = active ? "var(--mkt-accent)" : "var(--mkt-line)";
        return (
          <g key={p}>
            <rect
              x="4"
              y={y}
              width="130"
              height="24"
              rx="3"
              fill="var(--mkt-surface)"
              stroke={stroke}
            />
            <text
              x="16"
              y={y + 16}
              fontSize="10"
              fontFamily="var(--font-geist-mono)"
              fill={active ? "var(--mkt-accent)" : "var(--mkt-muted)"}
            >
              • {p}
            </text>
            <path
              d={`M134 ${y + 12} H170 L220 85`}
              stroke={stroke}
              strokeWidth={active ? 1.5 : 1}
            />
            <circle
              cx="170"
              cy={y + 12}
              r="3.5"
              fill="var(--mkt-surface)"
              stroke={stroke}
            />
          </g>
        );
      })}
      {/* Isometric core */}
      <path
        d="M220 85 L270 60 L320 85 L270 110 Z"
        fill="var(--mkt-surface)"
        stroke="var(--mkt-accent)"
      />
      <path
        d="M220 85 V120 L270 145 V110 M320 85 V120 L270 145"
        stroke="var(--mkt-line)"
      />
      <text
        x="270"
        y="89"
        textAnchor="middle"
        fontSize="10"
        fontFamily="var(--font-geist-mono)"
        fill="var(--mkt-accent)"
      >
        ORG
      </text>
      <text
        x="270"
        y="163"
        textAnchor="middle"
        fontSize="9"
        fontFamily="var(--font-geist-mono)"
        fill="var(--mkt-muted)"
      >
        CORE
      </text>
    </svg>
  );
}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit && npx eslint src/components/marketing/schematics`
Expected: clean. (Visual verification happens in Task 7 once they're on the page.)

- [ ] **Step 4: Commit**

```bash
git add src/components/marketing/schematics
git commit -m "feat: add schematic diagrams for marketing feature grid"
```

---

### Task 6: ASCII rack illustration

**Files:**

- Create: `src/components/marketing/ascii/rack-art.ts`, `src/components/marketing/ascii/RackIllustration.tsx`

**Interfaces:**

- Produces: `RACK_LINES: readonly string[]` (all lines equal length, pure ASCII); `RackIllustration()`, which renders `<pre aria-hidden>` and highlights `[[…]]`-marked segments in accent and `{{…}}` in warn.

- [ ] **Step 1: Write the art (markers `[[ ]]` = accent, `{{ }}` = warn; markers are stripped when rendering)**

Build the art by copying the `<pre>` content from `.superpowers/brainstorm/48901-1790781353/content/technical-assets.html` (Part 2, the approved rack). Then:

1. Wrap the highlighted crate's strokes in `[[` … `]]`, and the readout lines `~> STATUS`, `OUT FOR REPAIR`, `AT-00421` in `{{` … `}}` (replace the mock's `IN_REPAIR` with `OUT FOR REPAIR`, the real status name).
2. Right-pad every line with spaces so all rendered lines (markers removed) have equal length.
3. Export as:

```ts
// ascii/rack-art.ts
// Isometric storage rack (approved mockup). [[…]] = accent, {{…}} = warn.
export const RACK_LINES: readonly string[] = [
  // paste lines here, one string per line; escape backslashes as \\ and backticks are fine
];
```

Then add this test to `src/components/marketing/__tests__/sample-data.test.ts`:

```ts
import { RACK_LINES } from "../ascii/rack-art";

describe("rack art", () => {
  it("has equal-length lines once markers are stripped", () => {
    const widths = new Set(
      RACK_LINES.map((l) => l.replace(/\[\[|\]\]|\{\{|\}\}/g, "").length),
    );
    expect(widths.size).toBe(1);
  });
  it("is pure printable ASCII", () => {
    for (const l of RACK_LINES) expect(/^[\x20-\x7e]*$/.test(l)).toBe(true);
  });
});
```

Run: `npx vitest run src/components/marketing/__tests__/sample-data.test.ts`
Expected: PASS. It must also fail if you temporarily shorten one line, so check that once.

- [ ] **Step 2: Write the renderer**

```tsx
// ascii/RackIllustration.tsx
import type { ReactNode } from "react";
import { RACK_LINES } from "./rack-art";

const TOKEN = /(\[\[.*?\]\]|\{\{.*?\}\})/g;

function renderLine(line: string): ReactNode[] {
  return line.split(TOKEN).map((part, i) => {
    if (part.startsWith("[["))
      return (
        <span key={i} className="text-mkt-accent">
          {part.slice(2, -2)}
        </span>
      );
    if (part.startsWith("{{"))
      return (
        <span key={i} className="text-mkt-warn">
          {part.slice(2, -2)}
        </span>
      );
    return part;
  });
}

export function RackIllustration() {
  return (
    <div className="overflow-hidden">
      <pre
        aria-hidden="true"
        className="font-mkt-mono text-mkt-muted/70 text-[10px] leading-[1.15] sm:text-xs"
      >
        {RACK_LINES.map((line, i) => (
          <span key={i} className="block">
            {renderLine(line)}
          </span>
        ))}
      </pre>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/marketing/ascii src/components/marketing/__tests__/sample-data.test.ts
git commit -m "feat: add ASCII isometric rack illustration"
```

---

### Task 7: Landing sections and page assembly

**Files:**

- Create: `src/components/marketing/sections/{Hero,FactStrip,SchematicGrid,AsciiStatement,TcoPreview,DeployOptions,Faq,FinalCta}.tsx`
- Rewrite: `src/components/marketing/LandingPage.tsx` (named export `LandingPage`)
- Modify: `src/app/(marketing)/page.tsx` import → `import { LandingPage } from "@/components/marketing/LandingPage";`
- Test: `tests/e2e/marketing.spec.ts` (add landing assertions)

**Interfaces:**

- Consumes: everything from Tasks 1, 4, 5 and 6; `LANDING_FAQ` from `@/lib/seo` (shape `{ question: string; answer: string }[]`).
- Produces: `LandingPage()` plus one named export per section (`Hero`, `FactStrip`, `SchematicGrid`, `AsciiStatement`, `TcoPreview`, `DeployOptions`, `Faq`, `FinalCta`).

- [ ] **Step 1: Add failing landing tests**

Append inside the anonymous `describe` in `tests/e2e/marketing.spec.ts`:

```ts
test("landing shows the new hero, features and FAQ", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /Every asset, accounted for\./,
  );
  await expect(page.locator("#features")).toBeVisible();
  await expect(page.locator("#features article")).toHaveCount(6);
  await expect(page.locator("details")).not.toHaveCount(0);
  await expect(page.getByText("10,000+")).toHaveCount(0); // invented stats removed
});

test("FAQ JSON-LD is still emitted", async ({ page }) => {
  await page.goto("/");
  const blocks = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  expect(blocks.some((b) => b.includes('"FAQPage"'))).toBe(true);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test tests/e2e/marketing.spec.ts --project=chromium -g "landing|JSON-LD"`
Expected: "landing shows…" FAILS (old H1); the JSON-LD test PASSES (the baseline to keep).

- [ ] **Step 3: Write the sections**

```tsx
// sections/Hero.tsx
import Link from "next/link";
import { HERO, MARKETING_LINKS } from "../content";
import { SAMPLE_ASSETS } from "../sample-data";
import { BlockCursor } from "../primitives/BlockCursor";
import { CopyCommand } from "../primitives/CopyCommand";
import { Eyebrow } from "../primitives/Eyebrow";
import { ProductWindow } from "../primitives/ProductWindow";
import { StatusPill } from "../primitives/StatusPill";

const ROWS = SAMPLE_ASSETS.slice(0, 5);

export function Hero() {
  return (
    <section aria-label="Hero" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="mkt-grid pointer-events-none absolute inset-0"
      />
      <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28 lg:px-8">
        <Eyebrow>{HERO.eyebrow}</Eyebrow>
        <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
          {HERO.title}
          <BlockCursor />
        </h1>
        <p className="text-mkt-muted mx-auto mt-6 max-w-2xl text-base leading-relaxed sm:text-lg">
          {HERO.sub}
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={MARKETING_LINKS.register}
            className="bg-mkt-accent-fill text-mkt-accent-fill-fg rounded-md px-5 py-2.5 text-sm font-medium"
          >
            {HERO.primaryCta} →
          </Link>
          <CopyCommand command={HERO.command} />
        </div>
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <ProductWindow title="app / assets">
          <div className="overflow-x-auto">
            <table className="font-mkt-mono w-full min-w-[560px] text-left text-[12px]">
              <caption className="sr-only">
                Sample assets of a fictional company
              </caption>
              <thead className="text-mkt-muted text-[10px] tracking-widest uppercase">
                <tr>
                  {["Tag", "Name", "Status", "Assignee", "Location"].map(
                    (h) => (
                      <th
                        key={h}
                        scope="col"
                        className="px-4 py-2.5 font-normal"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((a, i) => (
                  <tr
                    key={a.tag}
                    className={`border-mkt-line border-t ${i === 0 ? "bg-mkt-accent/5" : ""}`}
                  >
                    <td className="text-mkt-muted px-4 py-3">{a.tag}</td>
                    <td className="px-4 py-3">{a.name}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={a.status} />
                    </td>
                    <td className="text-mkt-muted px-4 py-3">
                      {a.assignee ?? "—"}
                    </td>
                    <td className="text-mkt-muted px-4 py-3">{a.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ProductWindow>
      </div>
    </section>
  );
}
```

Note: the table uses `overflow-x-auto` **inside** the window, so on 375px the table scrolls within its own box and the page itself never overflows (Review Focus #2).

```tsx
// sections/FactStrip.tsx
import { FACTS } from "../content";

export function FactStrip() {
  return (
    <section aria-label="Platform facts" className="border-mkt-line border-y">
      <ul className="font-mkt-mono mx-auto grid max-w-7xl grid-cols-2 text-[12px] md:grid-cols-4">
        {FACTS.map((f, i) => (
          <li
            key={f}
            className={`border-mkt-line text-mkt-muted flex items-center gap-2 px-6 py-5 ${i % 2 === 0 ? "border-r" : ""} ${i < 2 ? "border-b md:border-b-0" : ""} ${i === 1 ? "md:border-r" : ""}`}
          >
            <span aria-hidden="true" className="bg-mkt-accent h-1.5 w-1.5" />
            {f}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

```tsx
// sections/SchematicGrid.tsx
import type { ReactNode } from "react";
import { FEATURES, FEATURE_CELLS } from "../content";
import { Eyebrow } from "../primitives/Eyebrow";
import { SchematicCell } from "../primitives/SchematicCell";
import { AuditLogSchematic } from "../schematics/AuditLog";
import { CheckoutSchematic } from "../schematics/Checkout";
import { ConsumablesSchematic } from "../schematics/Consumables";
import { IdentitySchematic } from "../schematics/Identity";
import { LicenseSeatsSchematic } from "../schematics/LicenseSeats";
import { LifecycleSchematic } from "../schematics/Lifecycle";

const CELLS: { key: keyof typeof FEATURE_CELLS; diagram: ReactNode }[] = [
  { key: "checkout", diagram: <CheckoutSchematic /> },
  { key: "licenses", diagram: <LicenseSeatsSchematic /> },
  { key: "lifecycle", diagram: <LifecycleSchematic /> },
  { key: "identity", diagram: <IdentitySchematic /> },
  { key: "consumables", diagram: <ConsumablesSchematic /> },
  { key: "audit", diagram: <AuditLogSchematic /> },
];

export function SchematicGrid() {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="mkt-reveal scroll-mt-20 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Eyebrow index="01">{FEATURES.eyebrow}</Eyebrow>
        <h2
          id="features-title"
          className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          {FEATURES.title}{" "}
          <span className="text-mkt-muted">{FEATURES.sub}</span>
        </h2>
        <div className="border-mkt-line bg-mkt-surface [&>*]:border-mkt-line mt-12 grid overflow-hidden rounded-xl border sm:grid-cols-2 lg:grid-cols-3 [&>*]:border-b lg:[&>*]:border-r lg:[&>*:nth-child(3n)]:border-r-0 sm:[&>*:nth-child(odd)]:border-r lg:[&>*:nth-last-child(-n+3)]:border-b-0">
          {CELLS.map((c) => (
            <SchematicCell key={c.key} copy={FEATURE_CELLS[c.key]}>
              {c.diagram}
            </SchematicCell>
          ))}
        </div>
      </div>
    </section>
  );
}
```

```tsx
// sections/AsciiStatement.tsx
import { ASCII_STATEMENT } from "../content";
import { RackIllustration } from "../ascii/RackIllustration";
import { Eyebrow } from "../primitives/Eyebrow";

export function AsciiStatement() {
  return (
    <section
      aria-labelledby="ascii-title"
      className="border-mkt-line mkt-reveal border-t py-24 sm:py-32"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <RackIllustration />
        <div>
          <Eyebrow index="02">{ASCII_STATEMENT.eyebrow}</Eyebrow>
          <h2
            id="ascii-title"
            className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            {ASCII_STATEMENT.title}
          </h2>
          <p className="text-mkt-muted mt-5 leading-relaxed">
            {ASCII_STATEMENT.body}
          </p>
          <ul className="font-mkt-mono text-mkt-muted mt-8 space-y-2 text-[12px]">
            {ASCII_STATEMENT.specs.map((s) => (
              <li key={s}>
                <span className="text-mkt-accent">→</span> {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
```

```tsx
// sections/TcoPreview.tsx
import { TCO } from "../content";
import { SAMPLE_TCO } from "../sample-data";
import { Eyebrow } from "../primitives/Eyebrow";
import { ProductWindow } from "../primitives/ProductWindow";

const MAX = Math.max(...SAMPLE_TCO.map((r) => r.purchase + r.maintenance));
const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function TcoPreview() {
  return (
    <section
      aria-labelledby="tco-title"
      className="border-mkt-line mkt-reveal border-t py-24 sm:py-32"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[2fr_3fr] lg:px-8">
        <div>
          <Eyebrow index="03">{TCO.eyebrow}</Eyebrow>
          <h2
            id="tco-title"
            className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            {TCO.title}
          </h2>
          <p className="text-mkt-muted mt-5 leading-relaxed">{TCO.body}</p>
          <p className="font-mkt-mono text-mkt-muted mt-6 text-[11px]">
            {TCO.footer}
          </p>
        </div>
        <ProductWindow title="app / tco · 3 years">
          <ul className="font-mkt-mono space-y-4 p-5 text-[12px]">
            {SAMPLE_TCO.map((r) => (
              <li key={r.label}>
                <div className="flex justify-between">
                  <span>{r.label}</span>
                  <span className="text-mkt-muted">
                    {eur.format(r.purchase + r.maintenance)}
                  </span>
                </div>
                <div
                  className="bg-mkt-line/40 mt-1.5 flex h-2 overflow-hidden rounded-[2px]"
                  aria-hidden="true"
                >
                  <span
                    className="bg-mkt-accent"
                    style={{ width: `${(r.purchase / MAX) * 100}%` }}
                  />
                  <span
                    className="bg-mkt-warn/80"
                    style={{ width: `${(r.maintenance / MAX) * 100}%` }}
                  />
                </div>
              </li>
            ))}
            <li className="text-mkt-muted flex gap-4 pt-2 text-[10px]">
              <span>
                <span className="bg-mkt-accent mr-1.5 inline-block h-2 w-2" />
                purchase
              </span>
              <span>
                <span className="bg-mkt-warn/80 mr-1.5 inline-block h-2 w-2" />
                maintenance
              </span>
            </li>
          </ul>
        </ProductWindow>
      </div>
    </section>
  );
}
```

```tsx
// sections/DeployOptions.tsx
import Link from "next/link";
import { DEPLOY, MARKETING_LINKS } from "../content";
import { CopyCommand } from "../primitives/CopyCommand";
import { Eyebrow } from "../primitives/Eyebrow";

export function DeployOptions() {
  return (
    <section
      aria-labelledby="deploy-title"
      className="border-mkt-line mkt-reveal border-t py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Eyebrow index="04">{DEPLOY.eyebrow}</Eyebrow>
        <h2
          id="deploy-title"
          className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          {DEPLOY.title}
        </h2>
        <div className="border-mkt-line mt-12 grid overflow-hidden rounded-xl border md:grid-cols-2">
          <div className="border-mkt-line bg-mkt-surface border-b p-8 md:border-r md:border-b-0">
            <h3 className="font-semibold">{DEPLOY.selfHost.title}</h3>
            <p className="text-mkt-muted mt-2 text-sm">
              {DEPLOY.selfHost.body}
            </p>
            <div className="mt-6">
              <CopyCommand command={DEPLOY.selfHost.command} />
            </div>
            <Link
              href={MARKETING_LINKS.github}
              className="font-mkt-mono text-mkt-accent mt-6 inline-block text-[12px]"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/LucaGerlich/asset-tracker →
            </Link>
          </div>
          <div className="bg-mkt-surface p-8">
            <h3 className="font-semibold">{DEPLOY.cloud.title}</h3>
            <p className="text-mkt-muted mt-2 text-sm">{DEPLOY.cloud.body}</p>
            <Link
              href={MARKETING_LINKS.pricing}
              className="bg-mkt-accent-fill text-mkt-accent-fill-fg mt-6 inline-block rounded-md px-4 py-2 text-sm font-medium"
            >
              See pricing →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
```

```tsx
// sections/Faq.tsx
import { ChevronDown } from "lucide-react";
import { LANDING_FAQ } from "@/lib/seo";
import { FAQ_HEADING } from "../content";
import { Eyebrow } from "../primitives/Eyebrow";

export function Faq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="border-mkt-line border-t py-24 sm:py-32"
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Eyebrow>{FAQ_HEADING.eyebrow}</Eyebrow>
        <h2
          id="faq-title"
          className="mt-4 text-3xl font-semibold tracking-tight"
        >
          {FAQ_HEADING.title}
        </h2>
        <div className="border-mkt-line divide-mkt-line mt-10 divide-y border-y">
          {LANDING_FAQ.map((f) => (
            <details key={f.question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                {f.question}
                <ChevronDown
                  aria-hidden="true"
                  className="text-mkt-muted h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="text-mkt-muted mt-3 text-sm leading-relaxed">
                {f.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
```

```tsx
// sections/FinalCta.tsx
import Link from "next/link";
import { FINAL_CTA, MARKETING_LINKS } from "../content";
import { BlockCursor } from "../primitives/BlockCursor";

export function FinalCta() {
  return (
    <section
      aria-labelledby="cta-title"
      className="border-mkt-line relative overflow-hidden border-t"
    >
      <div
        aria-hidden="true"
        className="mkt-grid pointer-events-none absolute inset-0"
      />
      <div className="relative mx-auto max-w-3xl px-4 py-28 text-center sm:px-6">
        <h2
          id="cta-title"
          className="text-4xl font-semibold tracking-tight sm:text-5xl"
        >
          {FINAL_CTA.title}
          <BlockCursor />
        </h2>
        <p className="text-mkt-muted mt-4">{FINAL_CTA.sub}</p>
        <div className="mt-9 flex items-center justify-center gap-4">
          <Link
            href={MARKETING_LINKS.register}
            className="bg-mkt-accent-fill text-mkt-accent-fill-fg rounded-md px-5 py-2.5 text-sm font-medium"
          >
            Start free →
          </Link>
          <Link
            href={MARKETING_LINKS.login}
            className="text-mkt-muted hover:text-mkt-text text-sm"
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Rewrite `LandingPage.tsx`**

```tsx
// src/components/marketing/LandingPage.tsx
import { AsciiStatement } from "./sections/AsciiStatement";
import { DeployOptions } from "./sections/DeployOptions";
import { FactStrip } from "./sections/FactStrip";
import { Faq } from "./sections/Faq";
import { FinalCta } from "./sections/FinalCta";
import { Hero } from "./sections/Hero";
import { SchematicGrid } from "./sections/SchematicGrid";
import { TcoPreview } from "./sections/TcoPreview";

export function LandingPage() {
  return (
    <>
      <Hero />
      <FactStrip />
      <SchematicGrid />
      <AsciiStatement />
      <TcoPreview />
      <DeployOptions />
      <Faq />
      <FinalCta />
    </>
  );
}
```

Update `src/app/(marketing)/page.tsx`: `import { LandingPage } from "@/components/marketing/LandingPage";`.

- [ ] **Step 5: Run tests and check visually**

Run: `npx tsc --noEmit && npx eslint src/components/marketing && npx playwright test tests/e2e/marketing.spec.ts --project=chromium`
Expected: all PASS.
Then open `http://localhost:3000/` in the browser pane at 1280 and 375 widths, in light and dark. Compare with the approved mockups (`hybrid-themes-v2.html`, `technical-assets.html`). Fix spacing and alignment until they match; take a screenshot of each of the 4 states and attach them to the PR later.

- [ ] **Step 6: Commit**

```bash
git add src/components/marketing "src/app/(marketing)/page.tsx" tests/e2e/marketing.spec.ts
git commit -m "feat: rebuild landing page with technical sections and product mocks"
```

---

### Task 8: Pricing restyle

**Files:**

- Modify: `src/app/(marketing)/pricing/PricingPageClient.tsx` (presentation only)

**Interfaces:**

- Consumes: `Eyebrow` (Task 4). Tier data, gating and FAQ content in this file stay **unchanged**.

- [ ] **Step 1: Add a failing test**

Append to the anonymous `describe` in `tests/e2e/marketing.spec.ts`:

```ts
test("pricing uses the marketing style and keeps its tiers", async ({
  page,
}) => {
  await page.goto("/pricing");
  await expect(page.getByText("[ PRICING ]", { exact: false })).toBeVisible();
  await expect(page.locator("[data-tier]")).not.toHaveCount(0);
});
```

Run: `npx playwright test tests/e2e/marketing.spec.ts --project=chromium -g pricing`. Expected: FAIL.

- [ ] **Step 2: Restyle**

In `PricingPageClient.tsx`:

1. Header: replace the H1 block's classes with `text-4xl font-semibold tracking-tight sm:text-5xl` and put `<Eyebrow>PRICING</Eyebrow>` above it; subtitle becomes `text-mkt-muted`.
2. Tiers grid: replace shadcn `Card`/`CardHeader`/`CardContent` with `<article data-tier={tier.name} className="bg-mkt-surface flex flex-col p-8">` inside a wrapper `border-mkt-line grid overflow-hidden rounded-xl border lg:grid-cols-3 [&>*]:border-mkt-line lg:[&>*:not(:last-child)]:border-r [&>*:not(:last-child)]:border-b lg:[&>*]:border-b-0`. For the highlighted tier, add `border-mkt-accent` via an inner `ring-1 ring-inset ring-[var(--mkt-accent)]` and a mono badge `font-mkt-mono text-mkt-accent text-[11px] uppercase tracking-widest`.
3. Price line: `font-mkt-mono text-4xl`, period in `text-mkt-muted text-sm`.
4. Feature list: `Check` icon → `<span className="text-mkt-accent font-mkt-mono">→</span>`; text `text-mkt-muted text-sm`.
5. CTA buttons: the primary tier gets `bg-mkt-accent-fill text-mkt-accent-fill-fg rounded-md`, others `border border-mkt-line rounded-md`. Keep the existing `href`s and `onClick`s exactly.
6. FAQ section: `border-mkt-line` borders, `text-mkt-muted` answers. Keep the `FAQItem` logic.
7. Remove now-unused imports (`Card*`, `Check`) so ESLint passes.

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit && npx eslint "src/app/(marketing)/pricing" && npx playwright test tests/e2e/marketing.spec.ts --project=chromium`
Expected: PASS. Check it visually in both themes at 375 and 1280.

```bash
git add "src/app/(marketing)/pricing" tests/e2e/marketing.spec.ts
git commit -m "feat: restyle pricing page to the marketing design"
```

---

### Task 9: Terms and privacy reading layout

**Files:**

- Modify: `src/app/(marketing)/terms/page.tsx`, `src/app/(marketing)/privacy/page.tsx` (presentation only; legal text unchanged)

- [ ] **Step 1: Add a failing test**

```ts
for (const path of ["/terms", "/privacy"]) {
  test(`${path} uses numbered mono section headings`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("h2 [data-section-no]").first()).toHaveText("01");
  });
}
```

Run: `npx playwright test tests/e2e/marketing.spec.ts --project=chromium -g "section headings"`. Expected: FAIL.

- [ ] **Step 2: Restyle both pages**

For each page:

1. Wrap content in `<article className="mx-auto max-w-3xl px-4 py-20 sm:px-6">`. Put `<Eyebrow>LEGAL</Eyebrow>` above the H1; H1 classes `mt-4 text-4xl font-semibold tracking-tight`. The "last updated" line becomes `font-mkt-mono text-mkt-muted text-[12px]`.
2. Prefix every `<h2>` with `<span data-section-no className="font-mkt-mono text-mkt-accent mr-3 text-sm">{"01"}</span>`, numbering sequentially `01`, `02`, … by hand in source order (the headings are static JSX).
3. Replace `text-muted-foreground` → `text-mkt-muted`, `text-foreground` → `text-mkt-text`, and `border-border*` → `border-mkt-line` across the file (sed is fine; review the diff).
4. Sections are separated by `border-mkt-line border-t pt-10 mt-10`.

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit && npx playwright test tests/e2e/marketing.spec.ts --project=chromium`
Expected: PASS. `git diff --stat` shows only class and markup changes (no prose changes): review `git diff -U0 "src/app/(marketing)/terms"` for any changed sentence.

```bash
git add "src/app/(marketing)/terms" "src/app/(marketing)/privacy" tests/e2e/marketing.spec.ts
git commit -m "feat: restyle terms and privacy with the marketing reading layout"
```

---

### Task 10: OG image

**Files:**

- Modify: `src/app/opengraph-image.tsx`

- [ ] **Step 1: Restyle using Satori-compatible inline styles**

Keep the font loading. Add Geist Mono: `node_modules/geist/dist/fonts/geist-mono/GeistMono-Regular.ttf`, and check the exact filename with `ls node_modules/geist/dist/fonts/geist-mono/`. Render:

- a background `#0b0b0c`, with the hairline grid drawn as `backgroundImage: "linear-gradient(to right, #1f1f22 1px, transparent 1px), linear-gradient(to bottom, #1f1f22 1px, transparent 1px)"`, `backgroundSize: "48px 48px"`;
- a mono eyebrow `[ OPEN SOURCE · MIT · SELF-HOSTABLE ]` in `#8a8a93`, 22px;
- the headline "Every asset, accounted for." in `#ededed`, 76px, semibold, followed by a lime block (a `div` 34×62, `#c6f36b`);
- a bottom row of mono text: `Asset Tracker` (left) and `IT asset management` (right), both in `#8a8a93`.

Satori supports only `display: flex` layouts; every `div` with multiple children needs `display: "flex"`.

- [ ] **Step 2: Verify**

Run `npm run dev`, then `curl -s -o /tmp/og.png -w "%{http_code} %{content_type}\n" localhost:3000/opengraph-image`.
Expected: `200 image/png`. Open the PNG with the Read tool and check that the text isn't clipped.

- [ ] **Step 3: Commit**

```bash
git add src/app/opengraph-image.tsx
git commit -m "feat: restyle OG image to the technical marketing look"
```

---

### Task 11: Cross-cutting E2E, overflow and accessibility in both themes

**Files:**

- Modify: `tests/e2e/marketing.spec.ts`, `tests/e2e/accessibility.spec.ts`

- [ ] **Step 1: Add the overflow and console-error tests**

Append to `tests/e2e/marketing.spec.ts`:

```ts
test.describe("marketing pages – layout robustness", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const scheme of ["light", "dark"] as const) {
    for (const path of PAGES) {
      test(`${path} (${scheme}) has no horizontal overflow at 375px and no console errors`, async ({
        page,
      }) => {
        const errors: string[] = [];
        page.on("console", (m) => {
          if (m.type() === "error") errors.push(m.text());
        });
        await page.emulateMedia({ colorScheme: scheme });
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
        expect(errors).toEqual([]);
      });
    }
  }
});
```

- [ ] **Step 2: Extend axe to marketing pages × themes**

Append inside the existing `describe` in `tests/e2e/accessibility.spec.ts` (it already sets anonymous `storageState` and has `logViolations`):

```ts
for (const scheme of ["light", "dark"] as const) {
  for (const path of ["/", "/pricing", "/terms", "/privacy"]) {
    test(`${path} (${scheme}) has no accessibility violations`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      logViolations(results.violations);
      expect(
        results.violations,
        `a11y violations on ${path} (${scheme})`,
      ).toEqual([]);
    });
  }
}
```

`reducedMotion: "reduce"` makes axe see final (non-animated) colors.

- [ ] **Step 3: Run and fix**

Run: `npx playwright test tests/e2e/marketing.spec.ts tests/e2e/accessibility.spec.ts --project=chromium`
Expected: PASS. For each `color-contrast` failure, adjust the token in `globals.css` (never per-component hex values) and update the spec's token table. For overflow failures, find the widest element with `page.evaluate(() => [...document.querySelectorAll("*")].filter(e => e.scrollWidth > innerWidth).map(e => e.className))` and constrain it (`overflow-hidden` on decorative wrappers, `min-w-0` on grid children).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/marketing.spec.ts tests/e2e/accessibility.spec.ts src/app/globals.css docs/superpowers/specs/2026-09-30-marketing-redesign-design.md
git commit -m "test: cover marketing pages for overflow and WCAG AA in both themes"
```

---

### Task 12: Repo links, version, changelog, final verification

**Files:**

- Modify: `README.md`, `docs/index.html`, `package.json`, `CHANGELOG.md`

- [ ] **Step 1: Replace fork URLs**

```bash
grep -rln "luca-fitseveneleven/assetTracker" README.md docs/index.html | xargs sed -i '' 's#luca-fitseveneleven/assetTracker#LucaGerlich/asset-tracker#g'
grep -rn "luca-fitseveneleven/assetTracker" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=graphify-out --exclude-dir=coverage . || echo "clean"
```

Expected: `clean`. Also check `git clone …` lines now say `asset-tracker` for the directory name used in any following `cd` command, and fix `cd assetTracker` → `cd asset-tracker` if present.

- [ ] **Step 2: Bump version and changelog**

`package.json`: `"version": "0.10.0"` → `"0.11.0"`. In `CHANGELOG.md`, under `## [Unreleased]`, add:

```md
## [0.11.0] - YYYY-MM-DD

### Changed

- **Marketing site redesign.** Landing, pricing, terms and privacy use a new technical design (hairline grid, mono type, lime accent) in light and dark. Product visuals are coded mocks with consistent sample data; schematic feature cells and an ASCII illustration replace the icon cards. The invented usage statistics are removed.
- Marketing pages live in a `(marketing)` route group with scoped `.mkt` theme tokens; the app's theme is unaffected. URLs are unchanged.
- The OG image matches the new look.
- README and docs link to the canonical repository `LucaGerlich/asset-tracker`.

### Fixed

- The theme toggle button has an accessible name.
```

Replace `YYYY-MM-DD` with the actual date of the release commit.

- [ ] **Step 3: Full verification**

```bash
npx tsc --noEmit
npm run lint
npm run test:unit
npx playwright test tests/e2e/marketing.spec.ts tests/e2e/accessibility.spec.ts
npm run build
```

Expected: all green. `npm run build` runs `prisma migrate deploy`. **Only run it against a local/dev database**; if `.env` points at the shared production DB, run `npx next build` instead (see the incident note in project memory).

- [ ] **Step 4: Commit**

```bash
git add README.md docs/index.html package.json CHANGELOG.md
git commit -m "chore: bump to 0.11.0, point docs at canonical repo"
```

- [ ] **Step 5: Hand off.** Report the screenshots (375/1280 × light/dark) to the user and ask whether to open a PR into `development`. Do not push without asking.
