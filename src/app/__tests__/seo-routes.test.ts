import { describe, it, expect, vi, afterEach } from "vitest";

const hostHeader = vi.hoisted(() => ({ value: "example.com" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: hostHeader.value }),
}));

import robots, { dynamic as robotsDynamic } from "@/app/robots";
import sitemap, { dynamic as sitemapDynamic } from "@/app/sitemap";

function enableSplit() {
  vi.stubEnv("NEXT_PUBLIC_MARKETING_URL", "https://example.com");
  vi.stubEnv("BETTER_AUTH_URL", "https://app.example.com");
}

afterEach(() => vi.unstubAllEnvs());

describe("sitemap", () => {
  it("lists marketing URLs on the marketing origin without app pages", () => {
    enableSplit();
    const urls = sitemap().map((e) => e.url);
    expect(urls).toContain("https://example.com");
    expect(urls).toContain("https://example.com/pricing");
    expect(
      urls.some((u) => u.includes("/login") || u.includes("/register")),
    ).toBe(false);
  });

  it("keeps today's entries when the split is disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_MARKETING_URL", "");
    vi.stubEnv("BETTER_AUTH_URL", "https://assets.example.com");
    const urls = sitemap().map((e) => e.url);
    expect(urls).toContain("https://assets.example.com/login");
  });
});

describe("sitemap and robots with sign-up closed or open", () => {
  function noSplit() {
    vi.stubEnv("NEXT_PUBLIC_MARKETING_URL", "");
    vi.stubEnv("BETTER_AUTH_URL", "https://assets.example.com");
    hostHeader.value = "assets.example.com";
  }

  async function allowedPaths(): Promise<string[]> {
    const rules = (await robots()).rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    const allow = rule.allow;
    return Array.isArray(allow) ? allow : allow ? [allow] : [];
  }

  it("omits /register from the sitemap and robots while sign-up is closed", async () => {
    noSplit();
    vi.stubEnv("ALLOW_PUBLIC_SIGNUP", "");

    expect(sitemap().map((e) => e.url)).not.toContain(
      "https://assets.example.com/register",
    );
    expect(await allowedPaths()).not.toContain("/register");
    expect(await allowedPaths()).toContain("/login");
  });

  it("lists /register in the sitemap and robots when sign-up is open", async () => {
    noSplit();
    vi.stubEnv("ALLOW_PUBLIC_SIGNUP", "true");

    expect(sitemap().map((e) => e.url)).toContain(
      "https://assets.example.com/register",
    );
    expect(await allowedPaths()).toContain("/register");
  });
});

describe("robots", () => {
  it("disallows everything on the app host", async () => {
    enableSplit();
    hostHeader.value = "app.example.com";
    const r = await robots();
    expect(r.rules).toEqual([{ userAgent: "*", disallow: "/" }]);
  });

  it("points the marketing host at the marketing sitemap", async () => {
    enableSplit();
    hostHeader.value = "example.com";
    const r = await robots();
    expect(r.sitemap).toBe("https://example.com/sitemap.xml");
  });
});

describe("runtime config", () => {
  // The proxy reads the split env at runtime, so these must not be frozen at
  // build time (e.g. a Docker image built without NEXT_PUBLIC_MARKETING_URL).
  it("renders robots and sitemap per request", () => {
    expect(robotsDynamic).toBe("force-dynamic");
    expect(sitemapDynamic).toBe("force-dynamic");
  });

  it("normalises a trailing slash in the marketing URL", () => {
    vi.stubEnv("NEXT_PUBLIC_MARKETING_URL", "https://example.com/");
    vi.stubEnv("BETTER_AUTH_URL", "https://app.example.com");
    expect(sitemap().map((e) => e.url)).toContain(
      "https://example.com/pricing",
    );
  });
});
