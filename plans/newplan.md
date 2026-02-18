Here is Claude's plan:

**Status Update (2026-02-18):** This plan has been consolidated into `plans/MASTER_PLAN.md`. Use the master plan for current status aligned with the codebase.

Summary
- Legacy modernization roadmap for UI migration, responsiveness, dependency updates, and testing.
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 Asset Management System - Modernization Plan

 Overview

 Complete modernization of the Next.js 15.5 asset management system including:
 - Clean up codebase (remove dead code, fix structure)
 - Complete UI migration from HeroUI/NextUI to shadcn/ui
 - Comprehensive responsive layouts (mobile, tablet, desktop)
 - Update all dependencies including breaking changes (Tailwind v4, Prisma v7)
 - Create shared table component
 - Set up automated E2E testing with Playwright

 Estimated Timeline: 20-27 days
 Approach: 5 phases with thorough testing between each

 ---
 Phase 1: Code Quality & Structure Cleanup (Days 1-3)

 1.1 Fix Directory Structure

 Issue: /src/app/licences/create.jsx/page.jsx exists as directory instead of file

 Actions:
 - Move to proper Next.js structure: /src/app/licences/create/page.jsx
 - Remove empty create.jsx directory
 - Test route: /licences/create

 1.2 Remove Console.logs

 Files: 31 files with 62 console.log occurrences

 Priority removals:
 - /src/ui/assets/DashboardTable.jsx (14 logs)
 - /src/app/api/*/route.js - Keep only error logging
 - Component files - Remove all debug logs

 Pattern:
 // Remove debug logs
 console.log("data:", data); // DELETE

 // Keep error logging in API routes
 console.error('Failed to fetch asset:', error); // KEEP

 1.3 Remove Dead Code

 Files to clean:
 - /src/components/Tabs.jsx - Imports deleted NextUI library (DELETE ENTIRE FILE)
 - /src/ui/assets/DashboardTable.jsx lines 244-286 - Commented NextUI code (DELETE)
 - /src/app/globals.css - Remove any commented code blocks

 1.4 Standardize Imports

 Issues:
 - Inconsistent relative paths: "../../../utils/utils" vs "../../utils/utils"
 - Mixed .jsx extension usage

 Actions:
 - Prefer @/ aliases over relative imports
 - Remove .jsx extensions from imports (rely on module resolution)

 Testing Phase 1:
 - npm run build succeeds
 - All routes load without errors
 - No console warnings about missing modules

 ---
 Phase 2: Complete UI Migration to shadcn/ui (Days 4-7)

 2.1 Remove HeroUI from Sidebar

 File: /src/components/Sidebar.jsx

 Current HeroUI imports:
 import { Button, Tooltip, ScrollShadow } from "@heroui/react";

 Replacements:
 - Button → @/components/ui/button (shadcn)
 - Tooltip → @/components/ui/tooltip (shadcn)
 - ScrollShadow → Custom CSS gradient effect

 ScrollShadow CSS (add to /src/app/globals.css):
 .scroll-shadow {
   overflow-y: auto;
   position: relative;
 }

 .scroll-shadow::before,
 .scroll-shadow::after {
   content: '';
   position: sticky;
   left: 0;
   right: 0;
   height: 20px;
   pointer-events: none;
   z-index: 10;
 }

 .scroll-shadow::before {
   top: 0;
   background: linear-gradient(to bottom, hsl(var(--background)), transparent);
 }

 .scroll-shadow::after {
   bottom: 0;
   background: linear-gradient(to top, hsl(var(--background)), transparent);
 }

 Props to update:
 - isIconOnly → remove, use size="icon"
 - onPress → onClick

 2.2 Remove HeroUI from Forms

 Files (8 total):
 - /src/app/suppliers/create/ui/SupplierCreateForm.jsx
 - /src/app/manufacturers/create/ui/ManufacturerCreateForm.jsx
 - /src/app/locations/create/ui/LocationCreateForm.jsx
 - /src/app/licences/create/ui/LicenceCreateForm.jsx
 - /src/app/consumables/create/ui/ConsumableCreateForm.jsx
 - /src/app/accessories/create/ui/AccessoryCreateForm.jsx
 - /src/app/assets/create/ui/AssetCreateForm.jsx
 - /src/app/assets/[id]/edit/ui/AssetEditForm.jsx

 Component mappings:
 - HeroUI Input → @/components/ui/input
 - HeroUI Select → @/components/ui/select
 - HeroUI Checkbox → @/components/ui/checkbox
 - HeroUI Textarea → @/components/ui/textarea

 For each form:
 1. Replace HeroUI imports with shadcn/ui
 2. Update component props (HeroUI → shadcn API differences)
 3. Test form submission
 4. Test validation and error states

 2.3 Uninstall HeroUI

 After all replacements:
 npm uninstall @heroui/react

 Verification:
 # Should return 0 results
 grep -r "@heroui" src/

 Testing Phase 2:
 - All forms submit successfully
 - Sidebar collapse/expand works
 - Tooltips display correctly
 - Visual regression: compare before/after screenshots
 - No HeroUI imports remain in codebase

 ---
 Phase 3: Comprehensive Responsive Layouts (Days 8-14)

 3.1 Add Mobile Navigation (Sheet/Drawer)

 File: /src/components/Navigation.jsx

 Issue: Menu is hidden sm:flex - completely inaccessible on mobile

 Solution: Add shadcn/ui Sheet component for mobile menu

 Install Sheet:
 npx shadcn@latest add sheet

 Implementation:
 import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
 import { Menu } from "lucide-react"

 // Mobile menu (visible only on mobile)
 <div className="lg:hidden">
   <Sheet>
     <SheetTrigger asChild>
       <Button variant="ghost" size="icon" aria-label="Open menu">
         <Menu className="h-6 w-6" />
       </Button>
     </SheetTrigger>
     <SheetContent side="left" className="w-72">
       <nav className="flex flex-col gap-4 mt-8">
         <Link href="/user" className="text-lg font-medium hover:text-primary">
           Users
         </Link>
         <Link href="/assets" className="text-lg font-medium hover:text-primary">
           Assets
         </Link>
         {/* Add all navigation items */}
       </nav>
     </SheetContent>
   </Sheet>
 </div>

 // Desktop menu (hide on mobile, show on lg+)
 <div className="hidden lg:flex gap-6">
   {/* existing desktop links */}
 </div>

 Sidebar updates:
 - Change hidden md:flex → hidden lg:flex (show on desktop only)
 - Mobile uses Sheet, tablet uses Sheet, desktop uses Sidebar

 3.2 Make StatCard Fully Responsive

 File: /src/components/StatCard.jsx

 Current issues:
 - Hardcoded h-28 (112px height)
 - Hardcoded text-5xl (font size)

 Responsive implementation:
 <Card className="w-full h-auto min-h-20 sm:min-h-24 md:min-h-28 lg:min-h-32">
   <CardHeader className="pb-2">
     <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
       {title}
     </CardTitle>
   </CardHeader>
   <CardContent className="pt-0">
     <div className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl text-primary font-bold">
       {value}
     </div>
   </CardContent>
 </Card>

 Breakpoint progression:
 - Mobile (default): text-xl, min-h-20
 - sm (640px): text-2xl, min-h-24
 - md (768px): text-3xl, min-h-28
 - lg (1024px): text-4xl, min-h-32
 - xl (1280px): text-5xl (original desktop size)

 3.3 Create Shared Responsive Table Component

 New file: /src/components/ui/responsive-table.jsx

 Purpose: Reusable table with built-in mobile responsiveness

 Features:
 - Horizontal scroll container for mobile
 - Optional mobile card view
 - Responsive column visibility
 - Consistent styling

 Base implementation:
 "use client"

 import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
 import { Card, CardContent } from "@/components/ui/card"

 export function ResponsiveTable({
   columns,
   data,
   renderCell,
   mobileCardView = false,
   minWidth = "800px",
   keyExtractor = (item) => item.id
 }) {
   if (mobileCardView) {
     return (
       <>
         {/* Mobile: Card view */}
         <div className="block lg:hidden space-y-4">
           {data.map((item) => (
             <Card key={keyExtractor(item)}>
               <CardContent className="pt-6">
                 <div className="space-y-2">
                   {columns.map((col) => (
                     <div key={col.key} className="flex justify-between">
                       <span className="font-medium text-muted-foreground">
                         {col.label}:
                       </span>
                       <span>{renderCell(item, col.key)}</span>
                     </div>
                   ))}
                 </div>
               </CardContent>
             </Card>
           ))}
         </div>

         {/* Desktop: Table view */}
         <div className="hidden lg:block overflow-x-auto rounded-md border">
           <Table style={{ minWidth }}>
             <TableHeader>
               <TableRow>
                 {columns.map((col) => (
                   <TableHead key={col.key}>{col.label}</TableHead>
                 ))}
               </TableRow>
             </TableHeader>
             <TableBody>
               {data.map((item) => (
                 <TableRow key={keyExtractor(item)}>
                   {columns.map((col) => (
                     <TableCell key={col.key}>
                       {renderCell(item, col.key)}
                     </TableCell>
                   ))}
                 </TableRow>
               ))}
             </TableBody>
           </Table>
         </div>
       </>
     )
   }

   // Scroll-only mode (no card view)
   return (
     <div className="w-full overflow-x-auto rounded-md border">
       <Table style={{ minWidth }}>
         <TableHeader>
           <TableRow>
             {columns.map((col) => (
               <TableHead key={col.key}>{col.label}</TableHead>
             ))}
           </TableRow>
         </TableHeader>
         <TableBody>
           {data.map((item) => (
             <TableRow key={keyExtractor(item)}>
               {columns.map((col) => (
                 <TableCell key={col.key}>
                   {renderCell(item, col.key)}
                 </TableCell>
               ))}
             </TableRow>
           ))}
         </TableBody>
       </Table>
     </div>
   )
 }

 3.4 Migrate All Tables to Responsive Base Component

 Files to migrate (10 tables):
 1. /src/ui/assets/DashboardTable.jsx (1365 lines - complex, migrate last)
 2. /src/ui/accessories/DashboardTable.jsx
 3. /src/ui/suppliers/DashboardTable.jsx
 4. /src/ui/user/DashboardTable.jsx
 5. /src/ui/licences/LicencesTable.jsx
 6. /src/ui/locations/LocationsTable.jsx
 7. /src/ui/manufacturers/ManufacturersTable.jsx
 8. /src/ui/consumables/ConsumablesTable.jsx
 9. /src/ui/accessories/AccessoriesTable.jsx
 10. /src/ui/suppliers/SuppliersTable.jsx

 Migration strategy:
 - Start with simplest table (manufacturers, locations)
 - Test thoroughly
 - Migrate complex tables (assets, users) last
 - Keep domain-specific logic (filters, actions) in page components

 For complex tables: May need custom responsive component that extends base

 3.5 Add Comprehensive Breakpoints Throughout

 Files to update:
 - /src/app/layout.js - Main padding
 - All form pages - Grid layouts
 - All dashboard pages - Spacing and layouts

 Pattern to apply:

 Padding/Spacing:
 // Before: p-6 md:p-8
 // After:  p-4 sm:p-6 md:p-8 lg:p-10

 Grid Layouts:
 // Before: grid-cols-1 md:grid-cols-3
 // After:  grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4

 Text Sizing:
 // Before: text-2xl
 // After:  text-lg sm:text-xl md:text-2xl lg:text-3xl

 Gaps:
 // Before: gap-6
 // After:  gap-4 sm:gap-6 md:gap-8

 Update Layout.js:
 <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12">
   {children}
 </main>

 3.6 Form Layout Responsiveness

 Pattern for all create/edit forms:

 Header with actions:
 <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
   <div>
     <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold">
       Create New Asset
     </h1>
   </div>
   <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
     <Button variant="outline" className="w-full sm:w-auto">Cancel</Button>
     <Button className="w-full sm:w-auto">Create</Button>
   </div>
 </div>

 Form grid:
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
   <section className="col-span-1">...</section>
   <section className="col-span-1 lg:col-span-2">...</section>
 </div>

 Testing Phase 3:
 - Mobile (375px): Navigation accessible via hamburger menu
 - Mobile (375px): All tables scroll horizontally or show card view
 - Mobile (375px): No horizontal page scroll
 - Tablet (768px): Proper 2-column layouts
 - Tablet landscape (1024px): Sidebar visible, 3-column layouts
 - Desktop (1440px): Full layout with all features visible
 - StatCard scales text across all breakpoints
 - Forms stack properly on mobile
 - Test on real devices (iOS Safari, Android Chrome)

 ---
 Phase 4: Safe Dependency Updates (Days 15-17)

 4.1 Update Non-Breaking Dependencies

 Safe updates (within semver range):

 npm update

 Specific version targets:
 {
   "react": "^19.2.3",
   "react-dom": "^19.2.3",
   "geist": "^1.5.1",
   "autoprefixer": "^10.4.23",
   "postcss": "^8.5.6",
   "sonner": "^1.7.4",
   "next-themes": "^0.4.6",
   "@faker-js/faker": "^10.2.0"
 }

 Testing after updates:
 - npm run build succeeds
 - Theme switching works (next-themes)
 - Toast notifications work (sonner)
 - Fonts load correctly (geist)

 4.2 Update Tailwind to Latest v3

 Update: 3.4.3 → 3.4.19

 npm install tailwindcss@^3.4.19

 Testing:
 - All styles render correctly
 - Dark mode still works
 - Custom CSS variables functional
 - All breakpoints work as expected

 4.3 Update Prisma to Latest v5

 Current: Prisma 5.12.1, @prisma/client 5.14.0 (mismatched!)
 Target: 5.22.0 for both

 npm install prisma@5.22.0 @prisma/client@5.22.0
 npx prisma generate

 Testing:
 - All API routes respond correctly
 - Database queries work (GET, POST, PUT, DELETE)
 - Seed script runs: npm run db:seed
 - No deprecation warnings
 - Test each entity: assets, users, accessories, suppliers, etc.

 Testing Phase 4:
 - Full build succeeds
 - All pages load
 - All CRUD operations work
 - npm audit shows no critical vulnerabilities
 - Performance baseline: check bundle size

 ---
 Phase 5: Breaking Change Migrations (Days 18-27)

 5.1 Migrate to Tailwind v4 (Days 18-22)

 Breaking changes: CSS-first configuration, new @theme directive

 Migration guide: https://tailwindcss.com/docs/upgrade-guide

 Steps:

 1. Install Tailwind v4:
 npm install tailwindcss@^4.1.18

 2. Convert config to CSS (replace tailwind.config.js):

 Create new CSS theme in /src/app/globals.css:
 @import "tailwindcss";

 @theme {
   /* Convert all theme values from tailwind.config.js */
   --color-background: 0 0% 100%;
   --color-foreground: 0 0% 3.9%;
   --color-card: 0 0% 100%;
   --color-card-foreground: 0 0% 3.9%;
   --color-popover: 0 0% 100%;
   --color-popover-foreground: 0 0% 3.9%;
   --color-primary: 0 0% 9%;
   --color-primary-foreground: 0 0% 98%;
   /* ... convert all CSS variables */

   --breakpoint-sm: 640px;
   --breakpoint-md: 768px;
   --breakpoint-lg: 1024px;
   --breakpoint-xl: 1280px;
   --breakpoint-2xl: 1536px;

   --font-family-geist-sans: "Geist", sans-serif;
   --font-family-geist-mono: "Geist Mono", monospace;

   --radius: 0.5rem;
 }

 @theme dark {
   --color-background: 0 0% 3.9%;
   --color-foreground: 0 0% 98%;
   /* ... dark mode values */
 }

 3. Remove tailwind.config.js (no longer needed in v4)
 4. Update PostCSS config (postcss.config.js):
 export default {
   plugins: {
     tailwindcss: {},
     autoprefixer: {},
   },
 }

 5. Test every component - v4 has subtle changes:
   - All shadcn/ui components render correctly
   - Custom CSS variables work
   - Dark mode switching works
   - All responsive breakpoints work
   - Animations still work (tailwindcss-animate)
 6. Fix breaking changes:
   - Some utility classes may have changed names
   - Default values may be different
   - Plugin API has changed

 Rollback plan: Keep tailwind.config.js backed up, can downgrade to v3 if needed

 5.2 Migrate to Prisma v7 (Days 23-25)

 Breaking changes: New query engine, relation behavior changes

 Migration guides:
 - https://www.prisma.io/docs/guides/upgrade-guides/upgrading-to-prisma-6
 - Check for v7 guide when available

 Steps:

 1. Backup database:
 # PostgreSQL backup
 pg_dump -U username -d assettracker > backup_$(date +%Y%m%d).sql

 2. Update incrementally (v5 → v6 → v7):

 v5 → v6:
 npm install prisma@6.0.0 @prisma/client@6.0.0
 npx prisma generate

 Test all database operations.

 v6 → v7:
 npm install prisma@^7.3.0 @prisma/client@^7.3.0
 npx prisma generate

 3. Update schema if needed (/prisma/schema.prisma):
   - Check for deprecated syntax
   - Update datasource/generator if required
 4. Test migrations:
 npx prisma migrate dev

 5. Update seed script if needed (/prisma/seed.js)
 6. Comprehensive API testing:
   - All GET endpoints work
   - All POST endpoints work
   - All PUT endpoints work
   - All DELETE endpoints work
   - Relation queries work correctly
   - Transactions work
   - Seed script runs successfully

 Rollback plan:
 - Restore database from backup if needed
 - Downgrade Prisma packages
 - Keep migration files versioned in git

 5.3 Update Next.js to v16 (Day 26)

 Current: 15.5.3
 Target: Latest stable v16

 Check official upgrade guide when ready (likely breaking changes)

 Steps:
 npm install next@latest

 Test thoroughly:
 - All routes work (App Router)
 - Server components work
 - API routes work
 - Dynamic imports work
 - Middleware works (if any)
 - Build and production mode work

 5.4 Final Integration Testing (Day 27)

 Full system test with all breaking changes:

 - Complete build succeeds
 - All pages render on all breakpoints
 - All forms submit correctly
 - All tables display and scroll properly
 - Database operations work end-to-end
 - Theme switching works
 - Mobile navigation works
 - Performance is acceptable (Lighthouse scores)
 - No console errors or warnings

 Testing Phase 5:
 - Run full E2E test suite (see Phase 6)
 - Manual testing on real devices
 - Load testing on large datasets
 - Check bundle size vs. baseline
 - Verify no regressions from Phase 4

 ---
 Phase 6: Automated E2E Testing Setup (Integrated Days 15-27)

 6.1 Install Playwright

 npm install -D @playwright/test
 npx playwright install

 6.2 Configure Playwright

 File: playwright.config.js

 import { defineConfig, devices } from '@playwright/test';

 export default defineConfig({
   testDir: './tests/e2e',
   fullyParallel: true,
   forbidOnly: !!process.env.CI,
   retries: process.env.CI ? 2 : 0,
   workers: process.env.CI ? 1 : undefined,
   reporter: 'html',
   use: {
     baseURL: 'http://localhost:3000',
     trace: 'on-first-retry',
   },
   projects: [
     {
       name: 'chromium',
       use: { ...devices['Desktop Chrome'] },
     },
     {
       name: 'Mobile Chrome',
       use: { ...devices['Pixel 5'] },
     },
     {
       name: 'Mobile Safari',
       use: { ...devices['iPhone 12'] },
     },
     {
       name: 'Desktop Safari',
       use: { ...devices['Desktop Safari'] },
     },
   ],
   webServer: {
     command: 'npm run dev',
     url: 'http://localhost:3000',
     reuseExistingServer: !process.env.CI,
   },
 });

 6.3 Create Core E2E Tests

 Directory: /tests/e2e/

 Test files to create:

 1. navigation.spec.js - Mobile and desktop navigation:
 import { test, expect } from '@playwright/test';

 test.describe('Navigation', () => {
   test('mobile navigation works', async ({ page }) => {
     await page.setViewportSize({ width: 375, height: 667 });
     await page.goto('/');

     // Open mobile menu
     await page.click('[aria-label="Open menu"]');

     // Click Assets link
     await page.click('text=Assets');
     await expect(page).toHaveURL(/\/assets/);
   });

   test('desktop navigation works', async ({ page }) => {
     await page.setViewportSize({ width: 1440, height: 900 });
     await page.goto('/');

     // Desktop nav visible
     await expect(page.locator('nav a:has-text("Assets")')).toBeVisible();
     await page.click('nav a:has-text("Assets")');
     await expect(page).toHaveURL(/\/assets/);
   });
 });

 2. responsive-layout.spec.js - Breakpoint testing:
 import { test, expect } from '@playwright/test';

 test.describe('Responsive Layouts', () => {
   const breakpoints = [
     { name: 'Mobile', width: 375, height: 667 },
     { name: 'Tablet', width: 768, height: 1024 },
     { name: 'Desktop', width: 1440, height: 900 },
   ];

   for (const { name, width, height } of breakpoints) {
     test(`${name} layout renders correctly`, async ({ page }) => {
       await page.setViewportSize({ width, height });
       await page.goto('/');

       // Check no horizontal scroll
       const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
       const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
       expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
     });
   }
 });

 3. asset-crud.spec.js - Asset create/read/update/delete:
 import { test, expect } from '@playwright/test';

 test.describe('Asset Management', () => {
   test('can create new asset', async ({ page }) => {
     await page.goto('/assets/create');

     // Fill form
     await page.fill('input[name="assetname"]', 'Test Asset');
     await page.fill('input[name="assettag"]', 'TEST-001');
     await page.selectOption('select[name="status"]', 'In Stock');

     // Submit
     await page.click('button:has-text("Create")');

     // Verify redirect and success
     await expect(page).toHaveURL(/\/assets/);
     await expect(page.locator('text=Test Asset')).toBeVisible();
   });

   test('can view asset details', async ({ page }) => {
     await page.goto('/assets');
     await page.click('text=Test Asset');

     await expect(page).toHaveURL(/\/assets\/\d+/);
     await expect(page.locator('h1')).toContainText('Test Asset');
   });
 });

 4. forms.spec.js - All form validations:
 import { test, expect } from '@playwright/test';

 test.describe('Form Validation', () => {
   test('asset form shows validation errors', async ({ page }) => {
     await page.goto('/assets/create');

     // Try to submit empty form
     await page.click('button:has-text("Create")');

     // Check for error messages
     await expect(page.locator('text=/required/i')).toBeVisible();
   });
 });

 5. table-functionality.spec.js - Table features:
 import { test, expect } from '@playwright/test';

 test.describe('Tables', () => {
   test('table scrolls on mobile', async ({ page }) => {
     await page.setViewportSize({ width: 375, height: 667 });
     await page.goto('/assets');

     // Check table is scrollable
     const table = page.locator('table').first();
     await expect(table).toBeVisible();

     // Verify overflow container exists
     const scrollContainer = page.locator('.overflow-x-auto').first();
     await expect(scrollContainer).toBeVisible();
   });

   test('table sorting works', async ({ page }) => {
     await page.goto('/assets');

     // Click column header to sort
     await page.click('th:has-text("Asset Name")');

     // Verify URL updated or rows reordered
     // Implementation depends on your sorting logic
   });
 });

 6. theme-switching.spec.js - Dark mode:
 import { test, expect } from '@playwright/test';

 test.describe('Theme', () => {
   test('can switch to dark mode', async ({ page }) => {
     await page.goto('/');

     // Open theme switcher
     await page.click('[aria-label="Toggle theme"]');
     await page.click('text=Dark');

     // Verify dark class applied
     const html = page.locator('html');
     await expect(html).toHaveClass(/dark/);
   });
 });

 6.4 Run Tests

 # Run all tests
 npx playwright test

 # Run specific test
 npx playwright test navigation.spec.js

 # Run in UI mode (visual debugging)
 npx playwright test --ui

 # Run only mobile tests
 npx playwright test --project="Mobile Chrome"

 # Generate test report
 npx playwright show-report

 6.5 CI Integration (Optional)

 Add to .github/workflows/ci.yml:

 name: CI
 on: [push, pull_request]

 jobs:
   test:
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v3
       - uses: actions/setup-node@v3
         with:
           node-version: '20'
       - run: npm ci
       - run: npx playwright install --with-deps
       - run: npm run build
       - run: npx playwright test
       - uses: actions/upload-artifact@v3
         if: always()
         with:
           name: playwright-report
           path: playwright-report/
           retention-days: 30

 ---
 Critical Files to Modify

 High Priority (Phase 1-3)

 1. /src/components/Sidebar.jsx - Remove HeroUI, keep mobile hidden
 2. /src/components/Navigation.jsx - Add mobile hamburger menu
 3. /src/components/StatCard.jsx - Make fully responsive
 4. /src/ui/assets/DashboardTable.jsx - Add scroll container, migrate to base component
 5. /src/components/ui/responsive-table.jsx - Create new base component

 Medium Priority (Phase 2-4)

 6. /src/app/layout.js - Update responsive breakpoints
 7. All form files (8 files) - Replace HeroUI components
 8. All table files (10 files) - Migrate to responsive base component
 9. /package.json - Update all dependencies
 10. /tailwind.config.js - Prepare for v4 migration

 Low Priority (Phase 5)

 11. /src/app/globals.css - Convert to Tailwind v4 @theme syntax
 12. /prisma/schema.prisma - Update for Prisma v7 if needed
 13. /playwright.config.js - Create new E2E config

 ---
 Testing & Verification Strategy

 After Each Phase

 1. Build test: npm run build must succeed
 2. Visual test: Manual check on 3 devices (mobile, tablet, desktop)
 3. Functional test: Core user flows work (navigation, forms, tables)
 4. Regression test: Previously working features still work

 Device Testing Matrix

 Test on these viewports:
 - Mobile: 375px (iPhone SE), 414px (iPhone Pro Max)
 - Tablet: 768px (iPad portrait), 1024px (iPad landscape)
 - Desktop: 1440px (standard laptop), 1920px (desktop monitor)

 Browsers

 - Chrome (primary)
 - Firefox
 - Safari (mobile and desktop)

 E2E Test Coverage

 - Navigation (mobile and desktop)
 - Asset CRUD (create, read, update, delete)
 - User CRUD
 - Form validation
 - Table functionality (sort, filter, pagination)
 - Theme switching
 - Responsive layouts (no horizontal scroll)
 - Mobile table scrolling

 ---
 Risk Mitigation

 Git Strategy

 - Branches: Create feature branch per phase
 - Commits: Small, atomic commits per component
 - Tags: Tag stable points (e.g., v1-phase-3-complete)
 - PRs: One PR per phase for easier review/revert

 Backup Strategy

 - Database backup before Prisma updates
 - package.json backup before dependency updates
 - Git tag before each phase

 Rollback Plan

 # Restore dependencies
 git checkout main -- package.json package-lock.json
 npm ci

 # Restore database (if Prisma migration failed)
 psql -U username -d assettracker < backup_20260126.sql

 # Revert to previous tag
 git reset --hard v1-phase-4-complete

 ---
 Success Criteria

 Phase 1-2 Complete

 - Zero console.logs in components
 - Zero HeroUI/NextUI imports
 - All forms submit successfully
 - Sidebar collapse/expand works

 Phase 3 Complete

 - Mobile navigation accessible on <768px
 - All tables scroll horizontally on mobile
 - No horizontal page scroll on any viewport
 - StatCard responsive across all breakpoints
 - 5 breakpoints used throughout (default, sm, md, lg, xl)

 Phase 4 Complete

 - All dependencies updated (non-breaking)
 - Zero high/critical npm audit vulnerabilities
 - All API endpoints functional
 - Performance baseline maintained

 Phase 5 Complete

 - Tailwind v4 working, all styles render correctly
 - Prisma v7 working, all queries functional
 - Next.js v16 working, all routes functional
 - Zero deprecation warnings
 - E2E tests pass with 100% success rate

 Overall Project Success

 - Mobile users can fully navigate the app
 - Responsive design works on all devices (375px to 1920px)
 - All dependencies on latest major versions
 - Automated E2E test suite with >80% coverage
 - No console errors or warnings
 - Lighthouse scores: Performance >80, Accessibility >95
 - Code is clean, consistent, and maintainable

 ---
 Timeline Summary
 ┌───────┬───────┬───────────────────────────────────────────────────────┐
 │ Phase │ Days  │                   Key Deliverables                    │
 ├───────┼───────┼───────────────────────────────────────────────────────┤
 │ 1     │ 1-3   │ Clean codebase, fix structure                         │
 ├───────┼───────┼───────────────────────────────────────────────────────┤
 │ 2     │ 4-7   │ Complete shadcn/ui migration                          │
 ├───────┼───────┼───────────────────────────────────────────────────────┤
 │ 3     │ 8-14  │ Comprehensive responsive layouts                      │
 ├───────┼───────┼───────────────────────────────────────────────────────┤
 │ 4     │ 15-17 │ Safe dependency updates                               │
 ├───────┼───────┼───────────────────────────────────────────────────────┤
 │ 5     │ 18-27 │ Breaking changes (Tailwind v4, Prisma v7, Next.js 16) │
 ├───────┼───────┼───────────────────────────────────────────────────────┤
 │ 6     │ 15-27 │ E2E testing setup (integrated)                        │
 └───────┴───────┴───────────────────────────────────────────────────────┘
 Total: 27 days for complete modernization with thorough testing

 ---
 Notes

 - Each phase builds on the previous one
 - Testing is integrated throughout, not just at the end
 - Breaking changes (Phase 5) have highest risk - thorough testing required
 - Rollback plan available at every phase
 - E2E tests provide safety net for all changes
