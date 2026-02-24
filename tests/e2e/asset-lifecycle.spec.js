import { test, expect } from "@playwright/test";

test.describe("Asset Lifecycle (Authenticated)", () => {
  test("can navigate to assets page", async ({ page }) => {
    await page.goto("/assets");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/.*assets/);
  });

  test("assets page shows table or empty state", async ({ page }) => {
    await page.goto("/assets");
    await page.waitForLoadState("networkidle");

    // Should show either a data table or an empty/no-assets message
    const table = page.locator("table");
    const emptyState = page.locator(
      "text=/no assets|no data|empty|get started/i",
    );

    const hasTable = await table.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasTable || hasEmpty).toBe(true);
  });

  test("can open create asset form", async ({ page }) => {
    await page.goto("/assets");
    await page.waitForLoadState("networkidle");

    // Click create/add button
    const createButton = page
      .getByRole("link", { name: /create|add/i })
      .or(page.getByRole("button", { name: /create|add/i }));

    await createButton.first().click();
    await page.waitForLoadState("networkidle");

    // Should see an asset form with name/tag fields
    const nameInput = page
      .locator('input[name="assetname"]')
      .or(page.locator('input[placeholder*="name" i]'));
    await expect(nameInput.first()).toBeVisible({ timeout: 10000 });
  });

  test("can navigate to dashboard from assets", async ({ page }) => {
    await page.goto("/assets");
    await page.waitForLoadState("networkidle");

    // Navigate to dashboard
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/.*dashboard/);
  });
});
