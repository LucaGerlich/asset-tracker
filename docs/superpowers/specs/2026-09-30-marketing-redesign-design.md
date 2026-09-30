# Marketing Site Redesign — Design Spec

- **Date:** 2026-09-30
- **Status:** Draft, awaiting review
- **Scope:** Public marketing pages only: `/`, `/pricing`, `/terms`, `/privacy`, the marketing nav/footer, and the OG image. The app, including the auth pages (login, register, invite, …), is **out of scope**.
- **Follow-up:** Domain split (`example.com` vs `app.example.com`), see `2026-09-30-domain-split-design.md`. It is implemented **after** this spec and does not block it.
- **Reference mockups (local, git-ignored):** `.superpowers/brainstorm/48901-1790781353/content/hybrid-themes-v2.html`, `technical-assets.html`

## 1. Goal

Replace the generic light, centered SaaS landing page with a **technical, engineered** marketing site that:

1. Feels like developer tooling (inspiration: oxide.computer, athas.dev, JetBrains Mono, openlogi.org, antigravity.google).
2. Shows the **product itself** through coded UI mocks and schematic diagrams populated with realistic sample data, not icon cards.
3. Supports **light and dark themes** equally well.
4. Makes only **true claims**. The invented stats band ("10,000+ assets", "500+ organizations", "99.9% uptime") and "Join hundreds of organizations" copy are removed.

### Success criteria

- All four pages render correctly in light and dark at 375 / 768 / 1280 px, with no horizontal scroll.
- Lighthouse Accessibility ≥ 95 and SEO = 100 on `/` in both themes. Text contrast is WCAG AA.
- Existing SEO is preserved: metadata, SoftwareApplication, Organization and FAQ JSON-LD, sitemap, robots, OG image.
- The only client JS added to marketing pages is the existing theme toggle. No new runtime dependencies.
- The redirects in `page.tsx` (signed-in user → `/dashboard`, `selfHosted` → `/login`) behave exactly as before.

## 2. Visual language

### Decisions (validated in the companion)

| Decision         | Choice                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| Direction        | "Engineered": option A's technical structure (hairline grid, mono labels, data readouts)           |
| Glow / gradients | **None.** No radial glows, no gradient text, no colored shadows                                    |
| Accent           | Lime only, used sparingly. Coral is reserved for error/warning states in diagrams                  |
| Themes           | Light + dark via the existing `next-themes` (system default + toggle)                              |
| Product visuals  | **Coded UI mocks** (React/SVG + typed sample data), no screenshots                                 |
| Technical assets | Product windows on a dark "stage", schematic feature cells (openlogi), ASCII isometric art (oxide) |

### Tokens (scoped under `.mkt`, never touching the app's shadcn tokens)

| Token                                      | Dark                  | Light                                 |
| ------------------------------------------ | --------------------- | ------------------------------------- |
| `--mkt-bg`                                 | `#0b0b0c`             | `#fbfbfa`                             |
| `--mkt-surface`                            | `#111114`             | `#ffffff`                             |
| `--mkt-line` (hairlines, grid)             | `#1f1f22`             | `#e7e7e4`                             |
| `--mkt-text`                               | `#ededed`             | `#111113`                             |
| `--mkt-muted`                              | `#8a8a93`             | `#5f5f67` (AA fix; was `#6b6b73`)     |
| `--mkt-accent` (text, paths, highlights)   | `#c6f36b`             | `#4d7c0f`                             |
| `--mkt-accent-fill` (primary button bg)    | `#c6f36b` (dark text) | `#111113` (light text, lime dot)      |
| `--mkt-warn` (coral: error/repair/reorder) | `#ff6b7a`             | `#c2410c`                             |
| `--mkt-stage` (product stage bg)           | `#111114`             | `#0f0f11` (stays dark in light theme) |

- Tokens are defined in `globals.css` under `.mkt` and `.dark .mkt`, matching the existing `.dark` class strategy that `next-themes` uses. They are exposed to Tailwind via `@theme inline` as `mkt-*` color utilities.
- Contrast is verified for every text/background pair in both themes during implementation. Any pair that fails AA is adjusted and the table updated.

### Typography

- **Geist Sans** (already loaded): headlines tight (`tracking-tight`, weight 600–700), body 16–18px.
- **Geist Mono** (already loaded): eyebrows (`[ 01 ] TRACK`), nav details, data readouts, spec footers, commands.
- Eyebrow format: `[ NN ] LABEL`, uppercase, mono, muted, with the number in accent.

### Recurring motifs

- **Hairline grid:** a 1px grid behind the hero and final CTA, faded out with a radial `mask-image` (a mask, not a glow).
- **Block cursor:** a solid accent block after the hero headline and the final CTA headline. It is static; blinking is only allowed without `prefers-reduced-motion`.
- **Dotted panel:** 1px dots every 12px, used inside schematic cells.
- **Mono spec footer:** API route, cron or protocol under each feature (e.g. `POST /api/v1/assets/:id/checkout`). Every footer must correspond to something that really exists in the codebase (verified during implementation).

### Motion

- A section fade-in via CSS `animation-timeline: view()`, with progressive enhancement: browsers without support show content statically.
- An optional typed-on hero sub-line (CSS `steps()`), no JS.
- Everything is disabled under `prefers-reduced-motion: reduce`.

## 3. Sample data

`src/components/marketing/sample-data.ts` is the **single source** for every mock and diagram, so asset tags, people, locations and dates stay consistent across the page.

- Fictional company: **Nordwerk GmbH**, locations `FRA-HQ`, `BER-02`, `MUC-01`.
- People (~8, lowercase handles): `m.keller`, `s.weber`, `j.braun`, `a.yilmaz`, `l.fischer`, `t.nguyen`, `k.schmidt`, `r.okafor`.
- Assets (~12), e.g. `AT-00412 MacBook Pro 14 · DEPLOYED · m.keller · FRA-HQ`, `AT-00421 iPhone 15 · IN_REPAIR · j.braun · MUC-01`, `AT-00413 Dell U2723QE · READY · — · FRA-HQ`.
- Licenses: Figma (18/20 seats, renews 2026-11-02), Microsoft 365, JetBrains All Products.
- Consumables: Toner HP 59A (86%), USB-C cables (32%, below the minimum, so `reorder`), Keyboards (100%).
- Audit events (5): checkout, license renew, status → IN_REPAIR, SCIM deprovision, check-in.
- TCO figures for one asset category (purchase, maintenance, depreciation), with small round numbers that are clearly illustrative.
- Status values use the app's real status names, so the mocks match what users see after signup.
- Types are explicit (`SampleAsset`, `SamplePerson`, …), with `as const` data and no `any`.

## 4. Page structure

### Shared shell: `src/app/(marketing)/layout.tsx`

The route group changes no URLs. The layout wraps children in `<div class="mkt">` and renders `MarketingNav` and `MarketingFooter`.

- **Nav:** mono logo mark + "Asset Tracker"; links Features (`/#features`), Pricing, GitHub. `/help` and `/api-docs` are auth-gated app routes (not in `publicRoutes`), so there is **no Docs link** until public docs exist. The GitHub URL is one constant, `MARKETING_LINKS.github`. It points to the canonical public repo `https://github.com/LucaGerlich/asset-tracker`. All references to the fork `luca-fitseveneleven/assetTracker` (README.md, docs/index.html) are replaced; a theme toggle (the existing `ThemeSwitcher`, restyled or wrapped); "Sign in"; primary "Start free". Mobile gets a disclosure menu using the existing pattern in `MarketingNav.tsx`.
- **Footer:** a hairline-divided grid of mono link columns (Product, Company, Legal, Get started), the version string, and a small ASCII mark.

### Landing page (`/`), top to bottom

1. **Hero:** eyebrow `[ OPEN SOURCE · MIT · SELF-HOSTABLE ]`; H1 "Every asset, accounted for." + block cursor; sub-line; CTAs "Start free →" (`/register`) and a copyable `$ docker compose up` chip (copy button = small client island, see §5). Below the hero, a **product stage**: a dark rounded panel holding a `ProductWindow` with the assets table (5 rows from the sample data).
2. **Fact strip:** four hairline-divided mono facts: `SSO · OIDC · SAML`, `SCIM 2.0 provisioning`, `MFA / TOTP`, `EU-hosted or self-hosted`.
3. **`[ 01 ] Features`: schematic grid (`id="features"`):** a 3×2 grid of `SchematicCell`s (see §5).
4. **`[ 02 ]` ASCII statement:** a two-column block, with the ASCII isometric rack on the left (AT-00421 traced in accent, readout `~> STATUS / IN_REPAIR / AT-00421`) and "Know where everything is. And what state it's in." plus a paragraph and a mono spec list on the right.
5. **`[ 03 ] Understand`: TCO preview:** a `ProductWindow` with a small SVG bar/line chart and figures from the sample data. The copy explains cost per asset and depreciation.
6. **`[ 04 ] Deploy`: Self-host vs Cloud:** two hairline cards. Self-host shows the `docker compose` snippet and the MIT license; Cloud shows EU hosting, managed updates and a link to Pricing.
7. **FAQ:** `LANDING_FAQ` rendered as `<details>` (no JS). The content is unchanged so the FAQ JSON-LD stays valid.
8. **Final CTA:** the hairline grid, "Start tracking in minutes." + block cursor, and the two CTAs.

### Pricing (`/pricing`)

- The same shell. `PricingPageClient` logic is unchanged; only its presentation is restyled: hairline plan cards, mono price line, mono spec footer per plan (limits), accent on the recommended plan.
- Plan data and gating logic are **not** touched.

### Terms / Privacy

- The same shell, with a reading layout (`max-w-3xl`), mono section numbers, and an optional sticky table of contents at `lg+`. The legal text is unchanged.

### OG image (`opengraph-image.tsx`)

- Restyled to the new look: dark background, hairline grid, mono eyebrow, headline + block cursor. No glow.

### 404 (optional, small)

- `not-found.tsx` gets a small ASCII piece. **Only if** it doesn't affect in-app 404 styling; otherwise skip.

## 5. Components

| Component                            | Responsibility                                                                                  | Client?      |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------ |
| `ProductWindow`                      | Window chrome (dots, mono title), dark stage frame; `children` = content                        | No           |
| `SchematicCell`                      | Dotted diagram panel + mono header/meta + ruler; text area with title, description, spec footer | No           |
| `schematics/Checkout`                | Pills routed via a node, `m.keller` path highlighted                                            | No           |
| `schematics/LicenseSeats`            | 20-seat meter (18 filled) + renewal timeline                                                    | No           |
| `schematics/Lifecycle`               | ORDERED→READY→DEPLOYED→IN_REPAIR→RETIRED; IN_REPAIR coral loops back to READY                   | No           |
| `schematics/Identity`                | Entra ID, Okta, Google Workspace, SAML 2.0, OIDC → isometric core                               | No           |
| `schematics/Consumables`             | Stock bars, USB-C cables in coral with `reorder`                                                | No           |
| `schematics/AuditLog`                | Mono `tail -f` stream of 5 events                                                               | No           |
| `ascii/RackIllustration`             | `<pre aria-hidden>` isometric rack + accent trace + readout                                     | No           |
| `sections/*`                         | One file per landing section (§4)                                                               | No           |
| Copy button on `docker compose` chip | `navigator.clipboard`                                                                           | Yes (tiny)   |
| Theme toggle                         | Existing `ThemeSwitcher`                                                                        | Yes (exists) |

- Each schematic is plain JSX/SVG using `currentColor` and `var(--mkt-*)`, so both themes work without duplicate markup.
- Every diagram gets `aria-hidden="true"`; the cell's title and description carry the meaning.
- Files stay small (< 200 lines each); the existing 341-line `LandingPage.tsx` is replaced by the section files.

## 6. Copy (draft, edit here)

- **H1:** Every asset, accounted for.
- **Sub:** Track hardware, licenses, consumables and maintenance for your IT team. One inventory, one audit trail, no spreadsheets.
- **Features H2:** One inventory, every workflow.
- **Cells:**
  - **Check-out & check-in:** "Assign assets to people or locations with due dates and a full return flow."
  - **License compliance:** "Seats, renewals and cost per license, with alerts before anything lapses."
  - **Full lifecycle:** "From purchase order to disposal, every state change is recorded."
  - **SSO & SCIM provisioning:** "Users and groups sync from your identity provider. Offboarding reclaims assets."
  - **Consumables & stock:** "Minimum quantities, reorder alerts and per-location stock levels."
  - **Tamper-evident audit trail:** "Every change with actor, timestamp and diff. Export for your auditor."
- **ASCII statement H2:** Know where everything is. And what state it's in.
- **TCO H2:** See what your hardware really costs.
- **Deploy H2:** Your server or ours.
- **Final CTA H2:** Start tracking in minutes.

Every feature claim in the copy must be verified against the codebase during implementation (e.g. whether SCIM offboarding reclaims assets automatically). Any claim that isn't true is reworded, not shipped.

## 7. SEO & metadata

- `createPageMetadata`, all JSON-LD, `sitemap.ts` and `robots.ts` keep their current behavior and URLs.
- The H1 changes from "IT Asset Management Software for Modern Teams" to "Every asset, accounted for." The keyword phrase "IT asset management software" moves into the eyebrow or sub-line and the `<title>` (unchanged) so ranking signals are kept.
- The Features section keeps `id="features"` (the nav anchor).

## 8. Error handling & edge cases

- Browsers without `animation-timeline` show content statically.
- If the Clipboard API is unavailable or denied, the copy button shows "Select & copy" and the command stays selectable.
- ASCII art below `sm` becomes a horizontally clipped decorative crop (`overflow-hidden`), never a scroll container, so the page has no horizontal scroll.
- Before hydration, `next-themes` + `suppressHydrationWarning` (already in the root layout) prevent a theme flash. Marketing tokens use the same `.dark` class.

## 9. Testing

1. **Unit (Vitest), TDD:** `sample-data.test.ts` checks that every assigned asset references an existing person and location, license seats in use ≤ total, consumable percentages are 0–100, and asset tags are unique.
2. **E2E (Playwright):** `tests/e2e/marketing.spec.ts`
   - `/`, `/pricing`, `/terms`, `/privacy` return 200 with no console errors, in light and dark (`colorScheme` emulation).
   - "Start free" → `/register`, "Sign in" → `/login`.
   - The theme toggle switches the `.dark` class and persists across reload.
   - No horizontal overflow at 375px (`scrollWidth <= clientWidth`).
3. **Accessibility:** extend the existing `test:a11y` (axe) run to all four marketing pages in both themes.
4. **Visual check:** screenshots at 375 / 768 / 1280 in both themes, reviewed before the PR.
5. **Build:** `tsc` strict, `eslint src/` and `next build` pass.

## 10. Housekeeping

- Bump `package.json` to the next minor version, add a CHANGELOG entry and update the audit file.
- Commits are small and logical (`feat:` / `fix:`), on branch `feat/marketing-redesign` off `development`.

## 11. Out of scope

- App UI and auth pages.
- The domain split (separate spec).
- Real screenshots, video and a blog.
- New dependencies (animation libs, icon packs, fonts).
