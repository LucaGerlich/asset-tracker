import { describe, it, expect } from "vitest";
import {
  getHostKind,
  getSplitOrigins,
  resolveHostRoute,
  type SplitOrigins,
  validateSplitConfig,
} from "@/lib/host-routing";

const origins: SplitOrigins = {
  marketing: new URL("https://example.com"),
  app: new URL("https://app.example.com"),
};

const route = (host: string | null, path: string, search = "") =>
  resolveHostRoute({ host, pathname: path, search, origins });

describe("getSplitOrigins", () => {
  it("is disabled when the marketing URL is unset", () => {
    expect(
      getSplitOrigins({ BETTER_AUTH_URL: "https://app.example.com" }),
    ).toBeNull();
  });

  it("is disabled when the app URL is unset", () => {
    expect(
      getSplitOrigins({ NEXT_PUBLIC_MARKETING_URL: "https://example.com" }),
    ).toBeNull();
  });

  it("parses both origins", () => {
    const o = getSplitOrigins({
      NEXT_PUBLIC_MARKETING_URL: "https://example.com",
      BETTER_AUTH_URL: "https://app.example.com",
    });
    expect(o?.marketing.host).toBe("example.com");
    expect(o?.app.host).toBe("app.example.com");
  });
});

describe("getHostKind", () => {
  it.each([
    ["example.com", "marketing"],
    ["app.example.com", "app"],
    ["APP.Example.com", "app"],
    ["asset-tracker-git-x.vercel.app", "other"],
    [null, "other"],
  ] as const)("%s → %s", (host, kind) => {
    expect(getHostKind(host, origins)).toBe(kind);
  });

  it("matches hosts with ports (local dev)", () => {
    const local: SplitOrigins = {
      marketing: new URL("http://localhost:3000"),
      app: new URL("http://app.localhost:3000"),
    };
    expect(getHostKind("localhost:3000", local)).toBe("marketing");
    expect(getHostKind("app.localhost:3000", local)).toBe("app");
    expect(getHostKind("localhost:3001", local)).toBe("other");
  });
});

describe("resolveHostRoute", () => {
  it("passes everything when the split is disabled", () => {
    expect(
      resolveHostRoute({
        host: "example.com",
        pathname: "/dashboard",
        search: "",
        origins: null,
      }),
    ).toEqual({ kind: "pass" });
  });

  it.each([
    "/",
    "/pricing",
    "/terms",
    "/privacy",
    "/opengraph-image",
    "/sitemap.xml",
    "/robots.txt",
  ])("marketing host serves %s", (path) => {
    expect(route("example.com", path)).toEqual({ kind: "pass" });
  });

  it.each([
    "/_next/static/chunk.js",
    "/__nextjs_original-stack-frame",
    "/favicon.ico",
    "/icons/icon-192.png",
    "/sw.js",
    "/manifest.json",
    "/logo.svg",
    "/api/health",
    "/monitoring",
  ])("always passes %s on the marketing host", (path) => {
    expect(route("example.com", path)).toEqual({ kind: "pass" });
  });

  it("sends app paths on the marketing host to the app, keeping the query", () => {
    expect(route("example.com", "/login", "?callbackUrl=%2Fassets")).toEqual({
      kind: "redirect",
      url: "https://app.example.com/login?callbackUrl=%2Fassets",
      status: 308,
    });
    expect(route("example.com", "/api/assets")).toMatchObject({
      url: "https://app.example.com/api/assets",
    });
  });

  it("never redirects off the configured origin (protocol-relative path)", () => {
    const r = route("example.com", "//evil.com/x");
    expect(r).toEqual({
      kind: "redirect",
      url: "https://app.example.com//evil.com/x",
      status: 308,
    });
    expect(r.kind === "redirect" && new URL(r.url).host).toBe(
      "app.example.com",
    );
  });

  it.each(["/pricing", "/terms", "/privacy", "/sitemap.xml"])(
    "sends %s on the app host to marketing",
    (path) => {
      expect(route("app.example.com", path, "?a=1")).toEqual({
        kind: "redirect",
        url: `https://example.com${path}?a=1`,
        status: 308,
      });
    },
  );

  it("sends the app host root to login with a real (non-cached) redirect", () => {
    expect(route("app.example.com", "/", "?x=1")).toEqual({
      kind: "redirect",
      url: "https://app.example.com/login",
      status: 307,
    });
  });

  it.each([
    "/login",
    "/dashboard",
    "/api/assets",
    "/robots.txt",
    "/opengraph-image",
  ])("app host serves %s", (path) => {
    expect(route("app.example.com", path)).toEqual({ kind: "pass" });
  });

  it("passes unknown hosts (preview deployments) untouched", () => {
    expect(route("asset-tracker-git-x.vercel.app", "/login")).toEqual({
      kind: "pass",
    });
    expect(route("asset-tracker-git-x.vercel.app", "/pricing")).toEqual({
      kind: "pass",
    });
  });
});

describe("validateSplitConfig", () => {
  const ok = {
    NEXT_PUBLIC_MARKETING_URL: "https://example.com",
    BETTER_AUTH_URL: "https://app.example.com",
    NODE_ENV: "production",
  };

  it("accepts a valid production config", () => {
    expect(validateSplitConfig(ok)).toBeNull();
  });

  it("is fine when the split is disabled", () => {
    expect(validateSplitConfig({ NODE_ENV: "production" })).toBeNull();
  });

  it("requires BETTER_AUTH_URL when the marketing URL is set", () => {
    expect(validateSplitConfig({ ...ok, BETTER_AUTH_URL: undefined })).toMatch(
      /BETTER_AUTH_URL/,
    );
  });

  it("rejects malformed URLs", () => {
    expect(
      validateSplitConfig({ ...ok, NEXT_PUBLIC_MARKETING_URL: "not a url" }),
    ).toMatch(/valid URL/);
  });

  it("rejects identical origins", () => {
    expect(
      validateSplitConfig({ ...ok, BETTER_AUTH_URL: "https://example.com/" }),
    ).toMatch(/differ/);
  });

  it("rejects http in production", () => {
    expect(
      validateSplitConfig({
        ...ok,
        NEXT_PUBLIC_MARKETING_URL: "http://example.com",
      }),
    ).toMatch(/https/);
  });

  it("allows http in development", () => {
    expect(
      validateSplitConfig({
        NEXT_PUBLIC_MARKETING_URL: "http://localhost:3000",
        BETTER_AUTH_URL: "http://app.localhost:3000",
        NODE_ENV: "development",
      }),
    ).toBeNull();
  });
});
