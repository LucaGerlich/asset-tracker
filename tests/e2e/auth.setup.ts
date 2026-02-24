import { test as setup, expect } from "@playwright/test";

const authFile = "tests/e2e/.auth/user.json";

setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.fill(
    'input[name="username"]',
    process.env.TEST_USERNAME || "admin",
  );
  await page.fill(
    'input[name="password"]',
    process.env.TEST_PASSWORD || "password",
  );
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*dashboard/, { timeout: 15000 });
  await page.context().storageState({ path: authFile });
});
