import { test, expect } from "@playwright/test";

const PAGES = ["/", "/pricing", "/terms", "/privacy"] as const;

test.describe("marketing pages (anonymous)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const path of PAGES) {
    test(`${path} renders inside the .mkt shell`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("div.mkt")).toHaveCount(1);
      await expect(page.locator("div.mkt header")).toHaveCount(1);
      await expect(page.locator("div.mkt footer")).toHaveCount(1);
    });
  }
});

test.describe("marketing pages (signed in)", () => {
  // Needs the seeded test user from auth.setup.ts, so it only runs when a
  // disposable database is configured (E2E_SIGNED_IN=1).
  test.skip(!process.env.E2E_SIGNED_IN, "requires a seeded test database");
  test.use({ storageState: "tests/e2e/.auth/user.json" });

  test("signed-in visitor on / is redirected to /dashboard", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
