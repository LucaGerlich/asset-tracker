import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  // These tests run WITHOUT pre-authenticated state
  test.use({ storageState: { cookies: [], origins: [] } });

  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/.*login/);
  });

  test("login form has required fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign in|log in/i }),
    ).toBeVisible();
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="username"]', "wronguser");
    await page.fill('input[name="password"]', "wrongpass");
    await page.click('button[type="submit"]');
    await expect(
      page.locator("text=/invalid|error|incorrect|failed/i"),
    ).toBeVisible({ timeout: 10000 });
  });

  test("register page is accessible", async ({ page }) => {
    await page.goto("/register");
    await expect(page).toHaveURL(/.*register/);
    await expect(
      page.getByRole("button", { name: /register|sign up|create/i }),
    ).toBeVisible();
  });
});
