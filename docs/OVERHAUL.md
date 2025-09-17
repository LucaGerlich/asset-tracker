## AssetTracker Frontend/API Overhaul — Implementation Notes

This document describes, in detail, all UI and API changes introduced in the recent overhaul across Asset, User, Dashboard, and auxiliary layers. It explains the rationale, file-level changes, data flows, UX decisions, safeguards, and how to validate each behavior.

---

### Goals

- Unify the visual language and page structure across detail, create, and edit screens with a clean, sectioned layout (Summary, Specifications, Procurement, Identifiers, etc.).
- Provide richer interactions on the asset and user pages, including inline assign/unassign workflows and refresh mechanisms.
- Improve table UX (status chips, deletion safeguards, assignment updates without reloads).
- Add missing API endpoints necessary for UI interactions and live refresh.
- Fix hydration issues by preventing client-only components or dynamic text from causing SSR/client mismatches.
- Add input validation (with debouncing) and unsaved-changes guards to reduce errors and accidental data loss.

---

## UI Changes

### 1) Asset Detail View

- File: `app/assets/[id]/page.jsx`
  - Now renders a clean header via `AssetDetailHeader` (client) with:
    - Title, asset tag/serial.
    - Status chip (resolves status name; live-updates after assignment to “Active” when applicable).
    - Edit button.
    - Action cluster: Assign User, Show QR Code.
  - Sectioned body:
    - Summary (status, location, requestable/mobile).
    - Specifications (manufacturer, model, specs, notes).
    - Procurement (supplier, price, timestamps).
    - Identifiers (asset tag, serial).
    - Placeholder for history.

- Files:
  - `app/assets/[id]/ui/AssetDetailHeader.jsx` (new, client)
    - Accepts `asset`, `statuses`, `users`, `userAssets`.
    - Displays status chip; updates to "Active" after successful assign.
  - `app/assets/[id]/ui/AssetDetailActions.jsx` (new, client)
    - Assign User modal (POST `/api/userAssets/assign`).
    - Show QR Code modal with download (PNG from canvas).
    - Calls `onAssigned()` callback to update header chip.

### 2) Asset Edit Page — Sectioned UI + Validation + Guard

- File: `app/assets/[id]/edit/page.jsx`
  - Server: fetches lookup lists; renders client form.

- File: `app/assets/[id]/edit/ui/AssetEditForm.jsx` (client)
  - Sectioned, clean layout matching detail page (Summary, Specifications, Procurement, Identifiers).
  - Inline uniqueness validation on blur for `assettag` and `serialnumber` via `GET /api/asset/validate`.
    - Skips validation if unchanged from original.
    - Disables Save when a duplicate is detected.
  - Unsaved-changes guard:
    - `beforeunload` prompt when form is dirty.
    - Cancel button asks to confirm discarding changes.
  - PUT `/api/asset` normalizes optional fields to `null`.

### 3) Asset Create Page — Sectioned UI + Default Status + Validation + Create & Assign

- File: `app/assets/create/page.jsx`
  - Server: loads Statuses, Categories, Manufacturers, Models, Suppliers, Locations, Users.
  - Renders the client form.

- File: `app/assets/create/ui/AssetCreateForm.jsx` (client)
  - Sectioned layout mirroring edit/detail.
  - Default status preselected to "Available" (if present).
  - Inline uniqueness validation (debounced on blur) for `assettag` and `serialnumber`.
  - Two submission flows:
    - Create: POST `/api/asset`, then redirect to the detail page.
    - Create & Assign: POST `/api/asset`, then opens modal to select user and POST `/api/userAssets/assign`, then redirect.
  - Reset + Cancel actions.

### 4) Assets Table — Robust Interactions and Refresh

- File: `app/ui/assets/DashboardTable.jsx` (client)
  - Fix: Asset rows no longer disappear on assign/unassign.
    - Maintains `userAssetsData` local state for immediate update of "Belongs To".
    - Updates asset `statustypeid` locally to reflect "Active" on assign or "Available" on unassign.
  - Delete flow:
    - Single delete warns: "This asset is assigned to X" when applicable.
    - Bulk delete: if any selection is assigned, shows checkbox confirmation and disables Delete until checked.
  - Refresh features:
    - Refresh button fetches `/api/asset` + `/api/userAssets` and updates state.
    - Auto-refresh when window regains focus or becomes visible.
    - Keyboard shortcut: `r` triggers refresh when not typing in inputs.
    - "Last updated" text is rendered hydration-safe (client-only with `suppressHydrationWarning`).

### 5) User Detail — Status Chips + Accessories + Licences

- File: `app/user/[id]/page.jsx`
  - Assigned Assets table now shows colored status chips resolved via StatusType.
  - Replaces static accessories/licences lists with `UserResources` component for inline assign/unassign.

- File: `app/user/[id]/ui/UserResources.jsx` (new, client)
  - Accessories:
    - Lists assigned items with Unassign.
    - Assign modal displays unassigned items; POST `/api/userAccessoires/assign`.
    - Unassign with DELETE `/api/userAccessoires/unassign`.
  - Licences:
    - Lists user-licensed items with Unassign.
    - Assign modal displays licences with `licenceduserid == null`; POST `/api/licence/assign`.
    - Unassign with DELETE `/api/licence/unassign`.
  - Refresh button and auto-refresh on focus/visibility (GET `/api/userAccessoires?userId=...`, `/api/accessories`, `/api/licence`).

### 6) User Edit/Create — Sectioned UI + Debounced Validation + Presets + Guard

- Files:
  - `app/user/[id]/edit/ui/UserEditForm.jsx` (client)
  - `app/user/create/page.jsx` (client)
  - Shared behaviors:
    - Sectioned layout (Profile, Contact, Permissions, Security).
    - Debounced (400ms) uniqueness validation for username/email via `GET /api/user/validate`.
    - Permission presets with quick buttons (Deactivated, Requester, Admin) plus manual checkboxes.
    - Unsaved-changes guard: beforeunload + cancel confirm (Edit page).

### 7) Dashboard (root) — Client Components Wrapped

- File: `app/page.jsx`
  - Replaced direct NextUI `Card` usage in server components with:
    - Client `StatCard` for the three summary tiles.
    - Plain Tailwind sections for "Latest Activity" and "Statistics" to avoid client-only components during SSR.
  - File: `app/components/StatCard.jsx` (new, client) wraps a NextUI Card for counts.

---

## API Endpoints

### Assets

- `DELETE /api/asset/deleteAsset` (updated):
  - Runs a transaction that first `deleteMany` on `userAssets` for the asset, then deletes the `asset`.
  - Avoids Prisma FK constraint errors.

- `GET /api/asset/validate` (new):
  - Query: `?assettag=...&serialnumber=...`
  - Returns `{ assettag: { exists }, serialnumber: { exists } }`.

### Users

- `GET /api/user` (new): list users; `?id=<userid>` returns one.
- `PUT /api/user` (new): update user; body must include `userid`. Normalizes boolean fields; optional password.
- `GET /api/user/validate` (new):
  - Query: `?username=...&email=...&excludeId=...`
  - Returns occupied state with optional `excludeId` to ignore current user during edit.

### User-Assets

- `GET /api/userAssets` (new): lists all links (used for table refresh).
- Existing assign/unassign routes are in place and used by both table and forms.

### Accessories & User-Accessories

- `GET /api/accessories` (new): list all accessories.
- `GET /api/userAccessoires?userId=...` (new): list user-accessory links (optionally filtered by user).
- `POST /api/userAccessoires/assign` (new): assign accessory to user.
- `DELETE /api/userAccessoires/unassign` (new): unassign accessory from user.

### Licences

- `GET /api/licence` (new): list all licences.
- `POST /api/licence/assign` (new): set `licenceduserid` to user.
- `DELETE /api/licence/unassign` (new): clear `licenceduserid`.

---

## Hydration & Stability

- Server pages no longer import client-only NextUI components directly. Instead, small client wrappers (e.g., `StatCard`) are used.
- Users table: date rendering changed from `toLocaleString()` to a stable ISO-like format to prevent SSR/client mismatches.
- Assets table: dynamic "Last updated" mark is rendered client-only with `suppressHydrationWarning` and a `mounted` gate.

---

## Validation & Debounce

- Assets: `assettag`, `serialnumber` validated via `/api/asset/validate` on blur with visual errors and disabled submit on conflicts.
- Users: `username`, `email` validated via `/api/user/validate` with 400ms debounce while typing; excludes current user during edit.

---

## Refresh Behavior

- Assets table
  - Button + auto-refresh on focus/visibility. Fetches `/api/asset` and `/api/userAssets`.
  - Keyboard `r` to refresh unless focused on an input.

- User detail (resources)
  - Button + auto-refresh on focus/visibility. Fetches `/api/userAccessoires?userId=...`, `/api/accessories`, `/api/licence` and recomputes assigned lists.

---

## Delete Flow & Foreign Keys

- API uses a transaction to delete user-asset links before deleting the asset.
- UI warns when deleting assigned assets; bulk deletion requires explicit confirmation when assigned items are included.

---

## Testing Checklist

1. Dashboard
   - Counts render; no hydration/useContext errors.

2. Assets list
   - Assign/unassign user updates row immediately and keeps row visible.
   - Refresh button works; auto-refresh on focus; keyboard `r` refresh works.
   - Delete single: warning shows if assigned; row removed after success.
   - Bulk delete: checkbox requirement appears if any assigned; operation succeeds.

3. Asset detail
   - Header status chip shows status name; after assign, chip updates to Active.
   - QR code shows/downloads.
   - Sections show resolved names for related fields.

4. Asset edit/create
   - Sectioned UI renders; optional fields map to `null`.
   - Uniqueness checks for tag/serial; Save/Create disabled on conflicts.
   - Edit: leaving with changes prompts; Cancel asks for confirmation.
   - Create & Assign opens modal; successful assignment redirects to detail.

5. User detail
   - Assigned assets table shows status chips with correct colors.
   - Accessories/licences: assign/unassign modals work; refresh updates lists.

6. User edit/create
   - Debounced username/email validation; Save/Create disabled on conflicts.
   - Permission presets toggle Admin/Requester/Deactivated; checkboxes still usable.
   - Edit: unsaved-changes guard works.

---

## File Map (Key Additions/Changes)

UI (client)
- `app/assets/[id]/ui/AssetDetailHeader.jsx`
- `app/assets/[id]/ui/AssetDetailActions.jsx`
- `app/assets/[id]/edit/ui/AssetEditForm.jsx`
- `app/assets/create/ui/AssetCreateForm.jsx`
- `app/ui/assets/DashboardTable.jsx` (major updates)
- `app/components/StatCard.jsx`
- `app/user/[id]/ui/UserResources.jsx`
- `app/user/[id]/edit/ui/UserEditForm.jsx`

UI (server)
- `app/assets/[id]/page.jsx` (uses header)
- `app/assets/[id]/edit/page.jsx`
- `app/assets/create/page.jsx`
- `app/user/[id]/page.jsx`
- `app/user/create/page.jsx`
- `app/page.jsx` (dashboard root)

APIs
- `app/api/asset/deleteAsset/route.js` (transactional delete)
- `app/api/asset/validate/route.js`
- `app/api/user/route.js` (GET/PUT)
- `app/api/user/validate/route.js`
- `app/api/userAssets/route.js` (GET)
- `app/api/accessories/route.js`
- `app/api/licence/route.js`
- `app/api/licence/assign/route.js`
- `app/api/licence/unassign/route.js`
- `app/api/userAccessoires/route.js`
- `app/api/userAccessoires/assign/route.js`
- `app/api/userAccessoires/unassign/route.js`

Data utilities
- `app/lib/data.js` (add `getUserAccessoires`)

---

## Notes & Future Enhancements

- History sections are placeholders. If you add a tracking table, we can render a timeline.
- We can add bulk status updates, filtering presets, and saved searches for large inventories.
- Consider server-side validation/enforcement for uniqueness and permission logic to complement client checks.
- Add activity widgets to the Dashboard to surface recent assignments/updates.

