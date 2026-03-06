import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility tests using axe-core (WCAG 2.1 AA).
 * These tests run WITHOUT pre-authenticated state so they can
 * verify public pages without needing a real backend session.
 */
test.describe("Accessibility (WCAG 2.1 AA)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("login page has no accessibility violations", async ({ page }) => {
    await page.goto("/login");

    // Wait for the login form to be visible before scanning
    await expect(page.locator('input[name="username"]')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    logViolations(results.violations);

    expect(
      results.violations,
      `Found ${results.violations.length} accessibility violation(s) on /login`,
    ).toEqual([]);
  });

  test("dashboard page (or redirect) has no accessibility violations", async ({
    page,
  }) => {
    // Unauthenticated users get redirected to /login — that is expected.
    // We still scan whatever page we land on for a11y issues.
    await page.goto("/dashboard");

    // Wait for navigation to settle
    await page.waitForLoadState("networkidle");

    const currentUrl = page.url();
    const pageName = currentUrl.includes("login")
      ? "/login (redirected from /dashboard)"
      : "/dashboard";

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    logViolations(results.violations);

    expect(
      results.violations,
      `Found ${results.violations.length} accessibility violation(s) on ${pageName}`,
    ).toEqual([]);
  });
});

/**
 * Print axe violations in a human-readable format so CI logs are useful.
 */
function logViolations(
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"],
) {
  if (violations.length === 0) return;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${violations.length} accessibility violation(s) found`);
  console.log(`${"=".repeat(60)}\n`);

  for (const v of violations) {
    console.log(`[${v.impact?.toUpperCase()}] ${v.id}: ${v.description}`);
    console.log(`  Help: ${v.helpUrl}`);
    console.log(
      `  WCAG: ${v.tags.filter((t) => t.startsWith("wcag")).join(", ")}`,
    );
    console.log(`  Affected nodes (${v.nodes.length}):`);
    for (const node of v.nodes) {
      console.log(`    - ${node.html}`);
      if (node.failureSummary) {
        console.log(
          `      ${node.failureSummary.split("\n").join("\n      ")}`,
        );
      }
    }
    console.log();
  }
}
