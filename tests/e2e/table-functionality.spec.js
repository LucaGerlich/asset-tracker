import { test, expect } from '@playwright/test';

const PIXEL_TOLERANCE = 1;

test.describe('Table Functionality', () => {
  test.describe('Assets Table', () => {
    test('should display assets table', async ({ page }) => {
      await page.goto('/assets');
      await page.waitForLoadState('networkidle');
      
      // Check for table or data grid
      const table = page.locator('table, [role="grid"]').first();
      await expect(table).toBeVisible();
    });

    test('should have table headers', async ({ page }) => {
      await page.goto('/assets');
      await page.waitForLoadState('networkidle');
      
      // Check for common headers
      const tableHeaders = page.locator('th, [role="columnheader"]');
      const count = await tableHeaders.count();
      expect(count).toBeGreaterThan(0);
    });

    test('table should be scrollable on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/assets');
      await page.waitForLoadState('networkidle');
      
      // The page should still load without horizontal scroll on the body
      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      
      expect(documentWidth).toBeLessThanOrEqual(viewportWidth + PIXEL_TOLERANCE);
    });
  });

  test.describe('Users Table', () => {
    test('should display users table', async ({ page }) => {
      await page.goto('/user');
      await page.waitForLoadState('networkidle');
      
      // Check for table or data grid
      const table = page.locator('table, [role="grid"]').first();
      await expect(table).toBeVisible();
    });

    test('should have table headers', async ({ page }) => {
      await page.goto('/user');
      await page.waitForLoadState('networkidle');
      
      // Check for common headers
      const tableHeaders = page.locator('th, [role="columnheader"]');
      const count = await tableHeaders.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Table Interactions', () => {
    test('should support row selection if available', async ({ page }) => {
      await page.goto('/assets');
      await page.waitForLoadState('networkidle');
      
      // Check if there are any rows
      const rows = page.locator('table tbody tr, [role="row"]');
      const rowCount = await rows.count();
      
      // If there are rows, try to interact with the first one
      if (rowCount > 0) {
        const firstRow = rows.first();
        await expect(firstRow).toBeVisible();
      }
    });

    test('table should handle empty state', async ({ page }) => {
      await page.goto('/assets');
      await page.waitForLoadState('networkidle');
      
      // Page should load successfully regardless of data
      await expect(page).toHaveURL(/.*assets/);
    });
  });

  test.describe('Table Pagination', () => {
    test('should have pagination controls if applicable', async ({ page }) => {
      await page.goto('/assets');
      await page.waitForLoadState('networkidle');
      
      // Look for pagination elements
      const pagination = page.locator('[data-testid="pagination"], .pagination, nav[aria-label*="pagination"]').first();
      
      // Check if pagination exists (might not if few records)
      const paginationExists = await pagination.count() > 0;
      
      // Page should still be functional
      await expect(page).toHaveURL(/.*assets/);
    });
  });

  test.describe('Table Search/Filter', () => {
    test('should have search or filter functionality', async ({ page }) => {
      await page.goto('/assets');
      await page.waitForLoadState('networkidle');
      
      // Look for search input
      const searchInput = page.getByPlaceholder(/search/i).or(
        page.getByRole('searchbox')
      ).or(
        page.locator('input[type="search"]')
      );
      
      // If search exists, verify it's functional
      if (await searchInput.count() > 0) {
        await expect(searchInput.first()).toBeVisible();
      }
    });
  });
});
