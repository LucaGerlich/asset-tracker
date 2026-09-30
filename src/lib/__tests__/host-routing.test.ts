import { describe, it, expect } from "vitest";
import {
  getHostKind,
  getSplitOrigins,
  resolveHostRoute,
  type SplitOrigins,
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

  it.each([
    "/",
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
