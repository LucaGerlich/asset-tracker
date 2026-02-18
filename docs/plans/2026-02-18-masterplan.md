# Masterplan: Surface Backend Features & Password Reset

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire up existing backend capabilities to the UI and add a complete password reset flow.

**Architecture:** Each task creates a client-side page or component that calls existing API routes. The password reset task adds new API routes + a forgot-password page + email integration. All UI follows existing patterns: shadcn/ui components, Tailwind, sonner toasts, server pages that delegate to "use client" components.

**Tech Stack:** Next.js 16 (App Router), React 19, shadcn/ui (Radix), Tailwind CSS, Prisma, sonner, lucide-react, recharts (for warranty chart)

---

## Task 1: Maintenance Scheduling Page

**Context:** API is complete at `/api/maintenance`, `/api/maintenance/[id]`, `/api/maintenance/[id]/complete`. The asset detail page shows inline schedules. We need a dedicated management page.

**Files:**
- Create: `src/app/maintenance/ui/MaintenancePageClient.tsx`
- Modify: `src/app/maintenance/page.tsx` (currently shows a "maintenance mode" page — replace)

**Step 1: Create the client component**

Create `src/app/maintenance/ui/MaintenancePageClient.tsx` — a "use client" component that:
- Fetches `GET /api/maintenance` on mount
- Renders a table (use same pattern as `src/ui/consumables/ConsumablesTable.tsx`) with columns: Asset Name, Title, Frequency, Assigned To, Next Due Date, Status, Actions
- Status badge: "Overdue" (red) if `nextDueDate < now`, "Due Soon" (yellow) if within 7 days, "Scheduled" (green) otherwise
- "Complete" button per row that calls `POST /api/maintenance/[id]/complete`
- "Create" button opens a Dialog with form fields: Asset (select from `/api/asset`), Title, Description (textarea), Frequency (select: daily/weekly/monthly/quarterly/annually), Next Due Date (date input), Assigned To (select from `/api/user`), Estimated Cost (number input)
- Dialog submit calls `POST /api/maintenance` then refetches
- "Delete" button per row with ConfirmDialog, calls `DELETE /api/maintenance/[id]`
- Uses sonner `toast.success` / `toast.error` for feedback

**Step 2: Replace the server page**

Rewrite `src/app/maintenance/page.tsx` to:
- Import and render `MaintenancePageClient`
- Add Breadcrumb with `[{ label: "Dashboard", href: "/" }, { label: "Maintenance" }]`
- Keep `export const metadata` with title "Maintenance Schedules - Asset Tracker"

**Step 3: Verify**

Run: `bunx tsc --noEmit` — expect clean
Run: `bun run build` — expect clean

**Step 4: Commit**

```
feat: add maintenance scheduling management page
```

---

## Task 2: Warranty Expiration Dashboard

**Context:** Assets have `warrantyMonths` and `warrantyExpires` fields. Asset detail page shows individual warranty status. We need a report-level view of all warranties.

**Files:**
- Create: `src/app/reports/ui/WarrantyReport.tsx`
- Modify: `src/app/reports/ui/ReportsPage.tsx` (add a "Warranty" tab)
- Modify: `src/app/reports/page.tsx` (pass warranty data to ReportsPage)

**Step 1: Add warranty data to reports page.tsx**

In `src/app/reports/page.tsx`, inside `getReportData()`, add a query after the existing Promise.all:
```typescript
const warrantyAssets = assets
  .filter((a) => a.warrantyExpires)
  .map((a) => ({
    id: a.assetid,
    name: a.assetname,
    tag: a.assettag,
    warrantyExpires: a.warrantyExpires.toISOString(),
    warrantyMonths: a.warrantyMonths,
    status: a.statusType?.statustypename || "Unknown",
    category: a.assetCategoryType?.assetcategorytypename || "Uncategorized",
  }));
```
Pass `warrantyAssets` to `<ReportsPage>` as a prop.

**Step 2: Create WarrantyReport component**

Create `src/app/reports/ui/WarrantyReport.tsx` — a "use client" component that:
- Accepts `warrantyAssets` prop
- Shows summary cards: Total Warranties, Expired, Expiring (30 days), Expiring (90 days), Active
- Renders a BarChart (recharts) showing warranty count by expiry month (next 12 months)
- Renders a table of assets sorted by `warrantyExpires` ascending, with columns: Asset Name, Tag, Category, Warranty Duration, Expires, Status (badge: Expired/Expiring Soon/Active)
- Each row links to `/assets/[id]`

**Step 3: Add Warranty tab to ReportsPage**

In `src/app/reports/ui/ReportsPage.tsx`:
- Add `warrantyAssets` to the props interface
- Add a new `<TabsTrigger value="warranty">Warranty</TabsTrigger>` after the existing tabs
- Add `<TabsContent value="warranty"><WarrantyReport warrantyAssets={warrantyAssets} /></TabsContent>`

**Step 4: Verify**

Run: `bunx tsc --noEmit` — expect clean
Run: `bun run build` — expect clean

**Step 5: Commit**

```
feat: add warranty expiration dashboard to reports
```

---

## Task 3: Custom Fields Admin UI

**Context:** Custom field definitions API exists at `/api/admin/custom-fields`. Values API at `/api/custom-fields/values`. The `CustomFieldsSection` component renders fields on the asset form. But there's no admin page to create/manage field definitions.

**Files:**
- Create: `src/app/admin/settings/ui/CustomFieldsAdminTab.tsx`
- Modify: `src/app/admin/settings/ui/AdminSettingsPage.tsx` (add Custom Fields tab)

**Step 1: Create the admin tab component**

Create `src/app/admin/settings/ui/CustomFieldsAdminTab.tsx` — a "use client" component that:
- Fetches `GET /api/admin/custom-fields` on mount
- Shows a table of field definitions: Name, Type, Entity Type, Required, Display Order, Active, Actions
- "Create Field" button opens Dialog with form: Name (input), Field Type (select: text/number/date/checkbox/select/textarea), Entity Type (select: asset/consumable/licence/accessory), Options (textarea, shown only when type=select, comma-separated), Required (switch), Display Order (number)
- Create submit calls `POST /api/admin/custom-fields`
- Edit button opens same Dialog pre-filled, submit calls `PUT /api/admin/custom-fields/[id]`
- Delete button with ConfirmDialog calls `DELETE /api/admin/custom-fields/[id]`
- Uses sonner toasts for feedback

**Step 2: Add tab to AdminSettingsPage**

In `src/app/admin/settings/ui/AdminSettingsPage.tsx`:
- Import `CustomFieldsAdminTab`
- Add `<TabsTrigger value="custom-fields">Custom Fields</TabsTrigger>`
- Add `<TabsContent value="custom-fields"><CustomFieldsAdminTab /></TabsContent>`

**Step 3: Verify**

Run: `bunx tsc --noEmit` — expect clean
Run: `bun run build` — expect clean

**Step 4: Commit**

```
feat: add custom fields management to admin settings
```

---

## Task 4: Consumable Checkout Improvements

**Context:** ConsumableDetailClient already has a checkout dialog. The consumables list table shows stock badges. What's missing: a "Restock" action to increase quantity, and audit logging for checkouts.

**Files:**
- Modify: `src/app/consumables/[id]/ui/ConsumableDetailClient.tsx` (add restock dialog)
- Modify: `src/app/api/consumable/route.ts` (add PATCH for restock)

**Step 1: Add PATCH restock endpoint**

In `src/app/api/consumable/route.ts`, add a PATCH handler:
```typescript
export async function PATCH(req) {
  try {
    await requireApiAdmin();
    const { consumableid, addQuantity } = await req.json();
    if (!consumableid || typeof addQuantity !== "number" || addQuantity <= 0) {
      return NextResponse.json({ error: "consumableid and positive addQuantity required" }, { status: 400 });
    }
    const updated = await prisma.consumable.update({
      where: { consumableid },
      data: { quantity: { increment: addQuantity }, change_date: new Date() },
    });
    return NextResponse.json(updated);
  } catch (error) { /* standard error handling */ }
}
```

**Step 2: Add Restock button and dialog to ConsumableDetailClient**

In `src/app/consumables/[id]/ui/ConsumableDetailClient.tsx`:
- Add a "Restock" button next to "Checkout"
- Add a Dialog with: Quantity to Add (number input), submit calls `PATCH /api/consumable` with `{ consumableid, addQuantity }`
- On success, update local qty state and toast

**Step 3: Verify**

Run: `bunx tsc --noEmit` — expect clean
Run: `bun run build` — expect clean

**Step 4: Commit**

```
feat: add consumable restock functionality
```

---

## Task 5: Password Reset Flow

**Context:** No password reset exists. Email infrastructure exists at `src/lib/email/`. The `verification_tokens` Prisma model exists. Rate limiting has a `passwordReset` config. Login page has no "Forgot Password" link.

**Files:**
- Create: `src/app/api/auth/forgot-password/route.ts`
- Create: `src/app/api/auth/reset-password/route.ts`
- Create: `src/app/forgot-password/page.tsx`
- Create: `src/app/forgot-password/ForgotPasswordForm.tsx`
- Create: `src/app/reset-password/page.tsx`
- Create: `src/app/reset-password/ResetPasswordForm.tsx`
- Modify: `src/app/login/LoginForm.tsx` (add "Forgot password?" link)
- Modify: `src/lib/email/templates.ts` (add password reset email template)

**Step 1: Add password reset email template**

In `src/lib/email/templates.ts`, add a `passwordReset` template to the `emailTemplates` object:
- Subject: "Reset your password - Asset Tracker"
- HTML body with: greeting, "You requested a password reset" message, reset link (`{{resetUrl}}`), expiry notice ("This link expires in 1 hour"), "If you didn't request this, ignore this email"

**Step 2: Create forgot-password API route**

Create `src/app/api/auth/forgot-password/route.ts`:
- POST handler that accepts `{ email }`
- Looks up user by email
- If found: generates a crypto random token, stores in `verification_tokens` table with 1-hour expiry, sends email via `queueEmail` with reset link `/reset-password?token=<token>&email=<email>`
- Always returns 200 with generic "If an account exists, we've sent a reset link" message (prevents email enumeration)
- Apply rate limiting using the `passwordReset` rate limiter

**Step 3: Create reset-password API route**

Create `src/app/api/auth/reset-password/route.ts`:
- POST handler that accepts `{ token, email, password }`
- Validates token exists in `verification_tokens` and hasn't expired
- Validates password meets complexity requirements (use existing password validation from `src/lib/auth-utils.ts`)
- Hashes password with bcrypt (use `hashPassword` from `src/lib/auth-utils.ts`)
- Updates user password
- Deletes the token
- Returns 200

**Step 4: Create forgot-password page**

Create `src/app/forgot-password/page.tsx` (server page) + `src/app/forgot-password/ForgotPasswordForm.tsx` (client component):
- Simple form with email input and "Send Reset Link" button
- On submit, calls `POST /api/auth/forgot-password`
- Shows success message: "If an account with that email exists, we've sent a password reset link."
- Link back to login page

**Step 5: Create reset-password page**

Create `src/app/reset-password/page.tsx` (server page) + `src/app/reset-password/ResetPasswordForm.tsx` (client component):
- Reads `token` and `email` from URL search params
- Form with: new password, confirm password
- Client-side validation: passwords match, minimum length
- On submit, calls `POST /api/auth/reset-password`
- On success, shows message and redirects to login

**Step 6: Add forgot password link to login**

In `src/app/login/LoginForm.tsx`, add below the password input field:
```tsx
<Link href="/forgot-password" className="text-sm text-primary hover:underline">
  Forgot your password?
</Link>
```

**Step 7: Verify**

Run: `bunx tsc --noEmit` — expect clean
Run: `bun run build` — expect clean

**Step 8: Commit**

```
feat: add complete password reset flow with email
```

---

## Task 6: Sidebar Update

**Files:**
- Modify: `src/components/Sidebar.tsx`

**Step 1: Add Maintenance to sidebar**

In `src/components/Sidebar.tsx`, in the "Tools" section items array, add:
```typescript
{ label: "Maintenance", href: "/maintenance", icon: Wrench },
```
Import `Wrench` from lucide-react.

**Step 2: Verify**

Run: `bun run build` — expect clean

**Step 3: Commit**

```
feat: add maintenance link to sidebar navigation
```
