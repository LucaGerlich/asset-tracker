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

  test("landing shows the new hero, features and FAQ", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /Every asset, accounted for\./,
    );
    await expect(page.locator("#features")).toBeVisible();
    await expect(page.locator("#features article")).toHaveCount(6);
    await expect(page.locator("details")).not.toHaveCount(0);
    await expect(page.getByText("10,000+")).toHaveCount(0); // invented stats removed
  });

  test("FAQ JSON-LD is still emitted", async ({ page }) => {
    await page.goto("/");
    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    expect(blocks.some((b) => b.includes('"FAQPage"'))).toBe(true);
  });

  test("dark preference is applied before hydration (no CSP-blocked theme script)", async ({
    page,
  }) => {
    const cspErrors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && m.text().includes("Content Security Policy"))
        cspErrors.push(m.text());
    });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(() => localStorage.setItem("theme", "system"));
    await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(cspErrors).toEqual([]);
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("pricing uses the marketing style and keeps its tiers", async ({
    page,
  }) => {
    await page.goto("/pricing");
    await expect(page.getByText("[ PRICING ]", { exact: false })).toBeVisible();
    await expect(page.locator("[data-tier]")).not.toHaveCount(0);
  });

  for (const path of ["/terms", "/privacy"]) {
    test(`${path} uses numbered mono section headings`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("h2 [data-section-no]").first()).toHaveText(
        "01",
      );
    });
  }

  test("OG image is public and renders as PNG", async ({ request }) => {
    const res = await request.get("/opengraph-image", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
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
