import { test, expect } from "@playwright/test";

// Runs only against a dev server started with the split enabled:
// NEXT_PUBLIC_MARKETING_URL=http://www.localhost:3000 BETTER_AUTH_URL=http://app.localhost:3000
// (Marketing must not be plain localhost:3000: in dev, Next shortens redirect
// Locations whose host equals its own request URL host, localhost:3000.)
const enabled = !!process.env.NEXT_PUBLIC_MARKETING_URL;
const MARKETING_HOST = "www.localhost:3000";
const APP_HOST = "app.localhost:3000";

test.describe("domain split", () => {
  test.skip(!enabled, "split not enabled for this run");

  test("marketing host sends /login to the app host", async ({ request }) => {
    const res = await request.get("/login?callbackUrl=%2Fassets", {
      maxRedirects: 0,
      headers: { host: MARKETING_HOST },
    });
    expect(res.status()).toBe(308);
    expect(res.headers().location).toBe(
      `http://${APP_HOST}/login?callbackUrl=%2Fassets`,
    );
  });

  test("marketing host serves the landing page", async ({ request }) => {
    const res = await request.get("/", {
      maxRedirects: 0,
      headers: { host: MARKETING_HOST },
    });
    expect(res.status()).toBe(200);
  });

  test("app host sends /pricing to the marketing host", async ({ request }) => {
    const res = await request.get("/pricing", {
      maxRedirects: 0,
      headers: { host: APP_HOST },
    });
    expect(res.status()).toBe(308);
    expect(res.headers().location).toBe(`http://${MARKETING_HOST}/pricing`);
  });

  test("app host / goes to login for anonymous visitors", async ({
    request,
  }) => {
    const res = await request.get("/", {
      maxRedirects: 0,
      headers: { host: APP_HOST },
    });
    expect([307, 308]).toContain(res.status());
    expect(res.headers().location).toMatch(/\/login$/);
  });

  test("app host is not indexable", async ({ request }) => {
    const res = await request.get("/robots.txt", {
      headers: { host: APP_HOST },
    });
    expect(await res.text()).toMatch(/Disallow: \/\s*$/m);
  });
});
