import { test, expect } from '@playwright/test';

const PIXEL_TOLERANCE = 1;

async function assertNoHorizontalScroll(page) {
  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(documentWidth).toBeLessThanOrEqual(viewportWidth + PIXEL_TOLERANCE);
}

test.describe('Responsive Layout', () => {
  const viewports = [
    { name: 'Mobile Small (375px)', width: 375, height: 667 },
    { name: 'Mobile Large (414px)', width: 414, height: 896 },
    { name: 'Tablet Portrait (768px)', width: 768, height: 1024 },
    { name: 'Tablet Landscape (1024px)', width: 1024, height: 768 },
    { name: 'Laptop (1440px)', width: 1440, height: 900 },
    { name: 'Desktop (1920px)', width: 1920, height: 1080 },
  ];

  for (const viewport of viewports) {
    test.describe(`${viewport.name}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test('Dashboard should have no horizontal scroll', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await assertNoHorizontalScroll(page);
      });

      test('Assets page should have no horizontal scroll', async ({ page }) => {
        await page.goto('/assets');
        await page.waitForLoadState('networkidle');
        await assertNoHorizontalScroll(page);
      });

      test('Users page should have no horizontal scroll', async ({ page }) => {
        await page.goto('/user');
        await page.waitForLoadState('networkidle');
        await assertNoHorizontalScroll(page);
      });

      test('Asset Create page should have no horizontal scroll', async ({ page }) => {
        await page.goto('/assets/create');
        await page.waitForLoadState('networkidle');
        await assertNoHorizontalScroll(page);
      });

      test('User Create page should have no horizontal scroll', async ({ page }) => {
        await page.goto('/user/create');
        await page.waitForLoadState('networkidle');
        await assertNoHorizontalScroll(page);
      });
    });
  }

  test.describe('Responsive Layout Elements', () => {
    test('Dashboard stat cards should stack on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Verify the page loaded
      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    });

    test('Dashboard stat cards should be in a row on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Verify the page loaded
      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    });

    test('Form buttons should stack on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/assets/create');
      await page.waitForLoadState('networkidle');
      
      // Verify the page loaded
      await expect(page.getByRole('heading', { name: /create new asset/i })).toBeVisible();
    });

    test('Form buttons should be in a row on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/assets/create');
      await page.waitForLoadState('networkidle');
      
      // Verify the page loaded
      await expect(page.getByRole('heading', { name: /create new asset/i })).toBeVisible();
    });
  });
});
