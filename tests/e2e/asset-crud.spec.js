import { test, expect } from '@playwright/test';

test.describe('Asset CRUD Operations', () => {
  test.describe('Asset List', () => {
    test('should display assets page', async ({ page }) => {
      await page.goto('/assets');
      await page.waitForLoadState('networkidle');
      
      // Check the page loads
      await expect(page).toHaveURL(/.*assets/);
    });

    test('should have create asset button', async ({ page }) => {
      await page.goto('/assets');
      await page.waitForLoadState('networkidle');
      
      // Look for a create/add button
      const createButton = page.getByRole('link', { name: /create/i }).or(
        page.getByRole('button', { name: /create/i })
      ).or(
        page.getByRole('link', { name: /add/i })
      ).or(
        page.getByRole('button', { name: /add/i })
      );
      
      // At least one should exist
      await expect(createButton.first()).toBeVisible();
    });
  });

  test.describe('Asset Create Form', () => {
    test('should navigate to create asset page', async ({ page }) => {
      await page.goto('/assets/create');
      await page.waitForLoadState('networkidle');
      
      await expect(page.getByRole('heading', { name: /create new asset/i })).toBeVisible();
    });

    test('should display required form fields', async ({ page }) => {
      await page.goto('/assets/create');
      await page.waitForLoadState('networkidle');
      
      // Check for Asset Name field
      await expect(page.getByLabel(/asset name/i)).toBeVisible();
      
      // Check for Asset Tag field
      await expect(page.getByLabel(/asset tag/i)).toBeVisible();
      
      // Check for Serial Number field
      await expect(page.getByLabel(/serial number/i)).toBeVisible();
    });

    test('should have Cancel button', async ({ page }) => {
      await page.goto('/assets/create');
      await page.waitForLoadState('networkidle');
      
      const cancelButton = page.getByRole('button', { name: /cancel/i });
      await expect(cancelButton.first()).toBeVisible();
    });

    test('should have Create button', async ({ page }) => {
      await page.goto('/assets/create');
      await page.waitForLoadState('networkidle');
      
      const createButton = page.getByRole('button', { name: /^create$/i });
      await expect(createButton.first()).toBeVisible();
    });

    test('should have form sections', async ({ page }) => {
      await page.goto('/assets/create');
      await page.waitForLoadState('networkidle');
      
      // Check for Summary section
      await expect(page.getByRole('heading', { name: /summary/i })).toBeVisible();
      
      // Check for Specifications section
      await expect(page.getByRole('heading', { name: /specifications/i })).toBeVisible();
      
      // Check for Procurement section
      await expect(page.getByRole('heading', { name: /procurement/i })).toBeVisible();
      
      // Check for Identifiers section
      await expect(page.getByRole('heading', { name: /identifiers/i })).toBeVisible();
    });
  });

  test.describe('Asset Detail View', () => {
    test('should navigate to asset detail page', async ({ page }) => {
      await page.goto('/assets');
      await page.waitForLoadState('networkidle');
      
      // Try to find and click on the first asset in the list
      const assetLink = page.locator('table tbody tr a, [data-testid="asset-row"] a').first();
      
      // If there are assets, click on one
      if (await assetLink.count() > 0) {
        await assetLink.click();
        await expect(page).toHaveURL(/.*assets\/\d+/);
      }
    });
  });
});
