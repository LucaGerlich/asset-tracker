## Next.js 15 Upgrade — Remediation Log and Rationale

This document records all changes applied after upgrading to Next.js 15.5.x to restore a stable dev experience, eliminate hydration/serialization errors, and align with new framework constraints.

---

### 1) Hydration mismatches in the header (Navigation)

Symptoms
- Runtime error: “Objects are not valid as a React child …” in `Navigation.jsx` while rendering the `@nextui-org/react` `<Navbar>`.

Root cause
- After the upgrade, the NextUI Navbar component tree produced non-serializable child structures during SSR/hydration at the app root. This caused React to choke on the top-level element during hydration.

Changes
- Replaced the NextUI Navbar with a plain Tailwind `<nav>` using Next.js `Link`s.
  - File: `app/components/Navigation.jsx` (rewritten to avoid NextUI Navbar/Dropdown at root).
  - Kept active route highlighting and the `ThemeSwitcher` control.

Benefit
- Removes complex client-only primitives from the SSR root, preventing top-level hydration failures.

---

### 2) Root-level hydration differences (class/color-scheme)

Symptoms
- Console hydration warning at `<html>`: class and/or `color-scheme` attributes differ between server and client.

Root cause
- `next-themes` and system theme behavior adjust classes and color-scheme on the client. The SSR output can differ slightly (especially with fonts/theme variables).

Changes
- Added `suppressHydrationWarning` to the `<html>` tag in `app/layout.js`:
  - `<html lang="en" suppressHydrationWarning className="...">`

Benefit
- Suppresses benign diffs at the root node that React can’t patch up but are safe to ignore.

---

### 3) Hydration mismatch in NextUI Tables (React Aria IDs)

Symptoms
- Console hydration mismatches inside NextUI `<Table>` on `/assets` and `/user` pages: React Aria-generated IDs differ between SSR and client.

Root cause
- React Aria generates dynamic IDs. Under Next 15, differences between SSR and client passes (or Turbopack ordering) surfaced as ID/key mismatches during hydration.

Changes (Client-only wrappers)
- Rendered heavy table components only on the client via tiny client wrappers that use `next/dynamic` with `ssr: false`:
  - `app/assets/ui/AssetsTableClient.jsx` → wraps `../../ui/assets/DashboardTable`.
  - `app/user/ui/UsersTableClient.jsx` → wraps `../../ui/user/DashboardTable`.
- Updated server pages to render these wrappers instead of importing the tables directly:
  - `app/assets/page.jsx` uses `AssetsTableClient`.
  - `app/user/page.jsx` uses `UsersTableClient`.

Note on Next 15 constraint
- `dynamic({ ssr: false })` is not allowed directly in Server Components. The wrappers are declared as Client Components (`"use client"`) to keep the server pages pure.

Benefit
- Eliminates SSR for the tables, ensuring a single client render with consistent React Aria IDs and no hydration diffs.

---

### 4) Passing Prisma Decimals to Client Components

Symptoms
- Error: “Only plain objects can be passed to Client Components … Decimal objects are not supported.”

Root cause
- Prisma `Decimal` values are non-serializable; Next 15 enforces that props passed to Client Components must be plain JSON-serializable objects.

Changes
- Converted `purchaseprice` fields to native numbers before passing to client components:
  - `app/assets/page.jsx` (assets list)
  - `app/assets/[id]/page.jsx` (asset detail)
  - `app/assets/[id]/edit/page.jsx` (asset edit initial data)
  - `app/user/[id]/page.jsx` (accessories/licences lists)

Benefit
- Removes serialization errors and keeps client props strictly JSON-safe.

---

### 5) Duplicate React keys in actions menu

Symptoms
- Error: “Encountered two children with the same key, `label`”

Root cause
- Two `<DropdownItem>` siblings used `key="label"`.

Changes
- Made keys unique in `app/ui/assets/DashboardTable.jsx`:
  - Change Status → `key="change-status"`
  - Generate Label → `key="generate-label"`

Benefit
- Restores stable identity in lists/menus, avoiding potential UI duplication/omission.

---

### 6) Remove client-only components from Server Components

Symptoms
- Build error: “`ssr: false` is not allowed with `next/dynamic` in Server Components. Please move it into a Client Component.”

Root cause
- Next 15 disallows `{ ssr: false }` inside server files; client-only code must live in a Client Component.

Changes
- Introduced Client wrappers (`AssetsTableClient`, `UsersTableClient`) instead of server `dynamic()` calls.
- Replaced server usage of `Button` (from NextUI) with Tailwind-styled `Link`s to avoid importing client components in server files.

Benefit
- Compliance with Next 15 boundaries; clearer separation between Server and Client Components.

---

### 7) Summary of files added/changed (upgrade-related)

Added
- `app/assets/ui/AssetsTableClient.jsx` (Client wrapper)
- `app/user/ui/UsersTableClient.jsx` (Client wrapper)

Changed
- `app/components/Navigation.jsx` (replaced NextUI Navbar with Tailwind nav)
- `app/layout.js` (add `suppressHydrationWarning` on `<html>`)
- `app/assets/page.jsx` (sanitize Decimal; use client wrapper)
- `app/assets/[id]/page.jsx` (sanitize Decimal)
- `app/assets/[id]/edit/page.jsx` (sanitize Decimal)
- `app/user/page.jsx` (use client wrapper; remove NextUI Button; Tailwind link)
- `app/user/[id]/page.jsx` (sanitize Decimal fields passed to client)
- `app/ui/assets/DashboardTable.jsx` (unique keys for dropdown items)

---

### 8) Validation tips for future changes

- Treat any NextUI/React Aria complex widgets as client-only when rendered directly from server routes.
- Ensure all props crossing the Server→Client boundary are strictly JSON-serializable (convert Prisma `Decimal` to Number; consider ISO-strings for dates if needed).
- Avoid top-level dynamic text or effects during SSR; if necessary, guard with `mounted` checks or `suppressHydrationWarning` where appropriate.

