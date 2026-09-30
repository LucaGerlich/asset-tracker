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

  test("nav links point to the right places", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Start free" })).toHaveAttribute(
      "href",
      "/register",
    );
    await expect(nav.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    await expect(nav.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/LucaGerlich/asset-tracker",
    );
  });

  test("theme toggle switches html.dark", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const html = page.locator("html");
    const before = (await html.getAttribute("class")) ?? "";
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("button", { name: /theme/i })
      .click();
    await expect
      .poll(async () =>
        ((await html.getAttribute("class")) ?? "").includes("dark"),
      )
      .toBe(!before.includes("dark"));
  });
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
