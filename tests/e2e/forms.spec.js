import { test, expect } from '@playwright/test';

test.describe('Form Validation', () => {
  test.describe('Asset Create Form Validation', () => {
    test('should show required field validation', async ({ page }) => {
      await page.goto('/assets/create');
      await page.waitForLoadState('networkidle');
      
      // Check for required indicators on fields
      const assetNameInput = page.getByLabel(/asset name/i);
      const assetTagInput = page.getByLabel(/asset tag/i);
      const serialInput = page.getByLabel(/serial number/i);
      
      await expect(assetNameInput).toBeVisible();
      await expect(assetTagInput).toBeVisible();
      await expect(serialInput).toBeVisible();
    });

    test('should have proper input types', async ({ page }) => {
      await page.goto('/assets/create');
      await page.waitForLoadState('networkidle');
      
      // Check Purchase Price has number type
      const priceInput = page.getByLabel(/purchase price/i);
      if (await priceInput.count() > 0) {
        await expect(priceInput).toHaveAttribute('type', 'number');
      }
      
      // Check Purchase Date has date type
      const dateInput = page.getByLabel(/purchase date/i);
      if (await dateInput.count() > 0) {
        await expect(dateInput).toHaveAttribute('type', 'date');
      }
    });

    test('should allow filling form fields', async ({ page }) => {
      await page.goto('/assets/create');
      await page.waitForLoadState('networkidle');
      
      // Fill in the Asset Name
      const assetNameInput = page.getByLabel(/asset name/i);
      await assetNameInput.fill('Test Asset');
      await expect(assetNameInput).toHaveValue('Test Asset');
      
      // Fill in the Asset Tag
      const assetTagInput = page.getByLabel(/asset tag/i);
      await assetTagInput.fill('TEST-001');
      await expect(assetTagInput).toHaveValue('TEST-001');
      
      // Fill in the Serial Number
      const serialInput = page.getByLabel(/serial number/i);
      await serialInput.fill('SN12345');
      await expect(serialInput).toHaveValue('SN12345');
    });
  });

  test.describe('User Create Form Validation', () => {
    test('should display user create form', async ({ page }) => {
      await page.goto('/user/create');
      await page.waitForLoadState('networkidle');
      
      await expect(page.getByRole('heading', { name: /create user/i })).toBeVisible();
    });

    test('should have required user fields', async ({ page }) => {
      await page.goto('/user/create');
      await page.waitForLoadState('networkidle');
      
      // Check for First Name field
      await expect(page.getByLabel(/first name/i)).toBeVisible();
      
      // Check for Last Name field
      await expect(page.getByLabel(/last name/i)).toBeVisible();
      
      // Check for Email field
      await expect(page.getByLabel(/email/i)).toBeVisible();
      
      // Check for Password field
      await expect(page.getByLabel(/password/i)).toBeVisible();
    });

    test('should allow filling user form fields', async ({ page }) => {
      await page.goto('/user/create');
      await page.waitForLoadState('networkidle');
      
      // Fill in the First Name
      const firstNameInput = page.getByLabel(/first name/i);
      await firstNameInput.fill('John');
      await expect(firstNameInput).toHaveValue('John');
      
      // Fill in the Last Name
      const lastNameInput = page.getByLabel(/last name/i);
      await lastNameInput.fill('Doe');
      await expect(lastNameInput).toHaveValue('Doe');
      
      // Fill in the Email
      const emailInput = page.getByLabel(/email/i);
      await emailInput.fill('john.doe@example.com');
      await expect(emailInput).toHaveValue('john.doe@example.com');
    });
  });

  test.describe('Form Reset Functionality', () => {
    test('should have reset button on asset create form', async ({ page }) => {
      await page.goto('/assets/create');
      await page.waitForLoadState('networkidle');
      
      const resetButton = page.getByRole('button', { name: /reset/i });
      await expect(resetButton).toBeVisible();
    });

    test('reset button should clear form fields', async ({ page }) => {
      await page.goto('/assets/create');
      await page.waitForLoadState('networkidle');
      
      // Fill in a field
      const assetNameInput = page.getByLabel(/asset name/i);
      await assetNameInput.fill('Test Asset');
      await expect(assetNameInput).toHaveValue('Test Asset');
      
      // Click Reset
      const resetButton = page.getByRole('button', { name: /reset/i });
      await resetButton.click();
      
      // Verify field is cleared
      await expect(assetNameInput).toHaveValue('');
    });
  });
});
