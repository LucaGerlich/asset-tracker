# Test Script — v0.7.0 Feature Verification

## Prerequisites

- Deploy to test environment (Vercel)
- Migration runs successfully (`prisma migrate deploy`)
- Set env vars:
  - `SUPER_ADMIN_EMAILS=your-email@example.com`
  - `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (test mode)
  - `CRON_SECRET=some-random-secret`
  - `SELF_HOSTED` should NOT be set (or set to `false`)

---

## 1. Plan Feature Gating

### 1.1 Verify Starter Plan Restrictions

- [ ] Log in as an admin on a **Starter** plan org
- [ ] Go to Admin Settings > SSO — should show "Upgrade Required" card with lock icon
- [ ] Go to Admin Settings > LDAP — should show "Upgrade Required" card
- [ ] Go to Admin Settings > API Keys — should show "Upgrade Required" card
- [ ] Verify the SSO/LDAP/API Keys tabs are still visible in the sidebar (just gated in content)

### 1.2 Verify Professional Plan Access

- [ ] Manually set your org's plan to `professional` in the database:
  ```sql
  UPDATE organizations SET plan = 'professional' WHERE id = 'your-org-id';
  ```
- [ ] Reload Admin Settings > SSO — should now show the actual SSO settings form
- [ ] Same for LDAP and API Keys — all unlocked

### 1.3 Verify Self-Hosted Mode

- [ ] Set `SELF_HOSTED=true` in env vars temporarily
- [ ] All features should be unlocked regardless of plan
- [ ] Billing tab should be hidden from admin settings sidebar
- [ ] Remove `SELF_HOSTED` env var after testing

---

## 2. Billing Management UI

### 2.1 Billing Tab Visibility

- [ ] Go to Admin Settings — "Billing" tab should appear in the General section
- [ ] Click Billing tab — should show current plan card

### 2.2 Usage Bars

- [ ] Verify asset count shown matches your actual asset count
- [ ] Verify user count shown matches your actual user count
- [ ] If on Starter (100 assets / 3 users), bars should show percentage
- [ ] If at 90%+ usage, a red warning should appear below the bar

### 2.3 Plan Comparison

- [ ] Three plan cards visible: Starter, Professional, Enterprise
- [ ] Current plan has "Current" badge
- [ ] Other plans show "Upgrade" button

### 2.4 Stripe Integration (if configured)

- [ ] Click "Upgrade to Professional" — should redirect to Stripe Checkout
- [ ] Complete a test payment with card `4242 4242 4242 4242`
- [ ] After payment, verify org plan updated to `professional` in database
- [ ] Return to Billing tab — should show "Manage Subscription" button
- [ ] Click "Manage Subscription" — should open Stripe Customer Portal

---

## 3. Trial Flow (14-day Professional)

### 3.1 New Registration

- [ ] Open an incognito window
- [ ] Go to `/register`
- [ ] Register a new account with a new company name
- [ ] After login, go to Admin Settings > Billing
- [ ] Should show "Professional" plan badge
- [ ] Should show trial banner: "Professional trial — 14 days remaining"
- [ ] Asset limit should be 5,000, user limit 25

### 3.2 Trial Expiry (Manual Test)

- [ ] In the database, set the new org's `trialEndsAt` to yesterday:
  ```sql
  UPDATE organizations
  SET "trialEndsAt" = NOW() - INTERVAL '1 day'
  WHERE name = 'your-test-org';
  ```
- [ ] Call the trial check cron manually:
  ```bash
  curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-app.vercel.app/api/cron/check-trials
  ```
- [ ] Should return `{ "downgraded": 1, "orgs": [...] }`
- [ ] Verify org is now on Starter plan with 100 asset / 3 user limits
- [ ] Log in as that org — Billing tab should show "Starter" plan, no trial banner

---

## 4. TCO Dashboard

### 4.1 Navigation

- [ ] As admin, check sidebar — "TCO Analysis" should appear in the nav
- [ ] Click it — should navigate to `/tco`

### 4.2 TCO Page Content

- [ ] 4 summary cards visible: Total Purchase Cost, Maintenance Cost, Depreciation Loss, Current Fleet Value
- [ ] If you have assets with purchase prices, values should be non-zero
- [ ] Category breakdown table should show categories with sortable columns
- [ ] Click column headers to sort
- [ ] Stacked bar chart should render (if you have categorized assets with costs)

### 4.3 Empty State

- [ ] If the org has no assets with prices, the page should still load without errors
- [ ] Values should show $0.00

---

## 5. Procurement Workflow

### 5.1 Navigation

- [ ] As admin, check sidebar — "Procurement" should appear
- [ ] Click it — should navigate to `/procurement`

### 5.2 Create Purchase Request

- [ ] Click "New Request" button
- [ ] Fill in:
  - Title: "Q3 Laptop Refresh"
  - Description: "Replace aging laptops for engineering team"
  - Priority: "High"
- [ ] Add line items:
  - Item 1: Type=Asset, Description="Dell Latitude 5550", Qty=5, Unit Cost=1200
  - Item 2: Type=Accessory, Description="USB-C Dock", Qty=5, Unit Cost=150
  - Item 3: Type=Consumable, Description="Laptop Bags", Qty=5, Unit Cost=50
- [ ] Verify running total shows $7,000.00 (5*1200 + 5*150 + 5\*50)
- [ ] Click "Save as Draft" — should redirect to request detail page

### 5.3 Submit for Approval

- [ ] On the request detail page, verify status shows "Draft"
- [ ] Click "Submit for Approval"
- [ ] Status should change to "Pending Approval"
- [ ] "Submit" button should disappear

### 5.4 Approve Request

- [ ] As an admin, the "Approve" and "Reject" buttons should be visible
- [ ] Click "Approve"
- [ ] Status should change to "Approved"

### 5.5 Reject Flow (separate test)

- [ ] Create another request, submit it
- [ ] Click "Reject" — a dialog should appear asking for a reason
- [ ] Enter a reason and confirm
- [ ] Status should change to "Cancelled"

### 5.6 Generate Purchase Order

- [ ] On the approved request, click "Generate Purchase Order"
- [ ] Should create a PO with number like `PO-202605-0001`
- [ ] Request status should change to "Ordered"
- [ ] PO link(s) should appear on the request detail page

### 5.7 View Purchase Order

- [ ] Click the PO link — should navigate to `/procurement/orders/[id]`
- [ ] PO details shown: PO number, supplier (if set), status, line items, total
- [ ] "Download PDF" button visible

### 5.8 Download PO PDF

- [ ] Click "Download PDF"
- [ ] PDF should open/download with:
  - "Purchase Order" header
  - PO number
  - Line items table
  - Grand total
  - Notes (if any)

### 5.9 Receive Goods

- [ ] On the PO detail page, click "Record Receipt"
- [ ] Enter received quantities for each item
- [ ] Submit receipt
- [ ] PO status should update (partially_received or received)
- [ ] For asset-type items: verify new assets were auto-created
  - Go to Assets page — new assets should appear with names from the PO items
  - Purchase price should match the estimated unit cost

### 5.10 Purchase Order List

- [ ] Go to `/procurement/orders`
- [ ] All created POs should be listed
- [ ] Status badges should reflect current state

---

## 6. Organization Scoping (Regression)

### 6.1 Shared Table Scoping

- [ ] Create a manufacturer as Org A admin
- [ ] Log in as a different org (Org B) — manufacturer should NOT be visible
- [ ] Same for suppliers, models, locations, categories, status types

### 6.2 Org Suspension (if testable)

- [ ] Set an org's `isActive=false, suspendedAt=NOW()` in the database
- [ ] Try to create an asset via API — should return 403 (read-only grace period)
- [ ] Reading assets should still work
- [ ] Set `suspendedAt` to 15 days ago — all access should be blocked (403)

---

## 7. Security (Regression)

### 7.1 CSV Injection

- [ ] Create an asset with name `=1+1`
- [ ] Export assets as CSV
- [ ] Open in Excel — the cell should show `'=1+1` (text, not formula result `2`)

### 7.2 Organization Management

- [ ] As a non-super-admin, the "Organizations" tab should be hidden in admin settings
- [ ] As a super-admin (email in `SUPER_ADMIN_EMAILS`), the tab should be visible

---

## 8. Self-Hosted Mode

### 8.1 Set SELF_HOSTED=true

- [ ] All plan-gated features (SSO, LDAP, API Keys, Procurement, TCO) should be accessible
- [ ] Billing tab should be hidden
- [ ] No quota limits enforced (can create unlimited assets/users)
- [ ] No trial banner shown

---

## Quick Smoke Test (5-minute version)

If you're short on time, verify these critical paths:

1. [ ] Admin Settings > Billing tab loads and shows plan info
2. [ ] Admin Settings > SSO shows upgrade prompt on Starter
3. [ ] `/tco` page loads with charts
4. [ ] `/procurement` page loads, can create a request with items
5. [ ] Can approve request and generate PO
6. [ ] PO PDF downloads
7. [ ] Goods receipt creates assets automatically
