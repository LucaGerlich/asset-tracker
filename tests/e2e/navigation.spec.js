import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.describe('Desktop Navigation', () => {
    test('should navigate to all main pages', async ({ page }) => {
      await page.goto('/');
      
      // Verify dashboard is loaded
      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
      
      // Navigate to Assets
      await page.getByRole('link', { name: /assets/i }).first().click();
      await expect(page).toHaveURL(/.*assets/);
      
      // Navigate to Users
      await page.getByRole('link', { name: /user/i }).first().click();
      await expect(page).toHaveURL(/.*user/);
      
      // Navigate to Accessories
      await page.getByRole('link', { name: /accessories/i }).first().click();
      await expect(page).toHaveURL(/.*accessories/);
      
      // Navigate to Consumables
      await page.getByRole('link', { name: /consumables/i }).first().click();
      await expect(page).toHaveURL(/.*consumables/);
      
      // Navigate to Licences
      await page.getByRole('link', { name: /licences/i }).first().click();
      await expect(page).toHaveURL(/.*licences/);
      
      // Navigate to Locations
      await page.getByRole('link', { name: /locations/i }).first().click();
      await expect(page).toHaveURL(/.*locations/);
      
      // Navigate to Manufacturers
      await page.getByRole('link', { name: /manufacturers/i }).first().click();
      await expect(page).toHaveURL(/.*manufacturers/);
      
      // Navigate to Suppliers
      await page.getByRole('link', { name: /suppliers/i }).first().click();
      await expect(page).toHaveURL(/.*suppliers/);
    });

    test('should show navigation menu on desktop', async ({ page }) => {
      await page.goto('/');
      
      // Desktop should show navigation links directly
      const nav = page.locator('nav');
      await expect(nav).toBeVisible();
    });
  });

  test.describe('Mobile Navigation', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should be able to navigate on mobile', async ({ page }) => {
      await page.goto('/');
      
      // Verify dashboard loads on mobile
      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    });

    test('should have accessible navigation on mobile', async ({ page }) => {
      await page.goto('/');
      
      // Check that navigation is present
      const nav = page.locator('nav');
      await expect(nav).toBeVisible();
    });
  });
});
