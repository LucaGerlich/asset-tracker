# Domain Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve marketing at `NEXT_PUBLIC_MARKETING_URL` and the app at `BETTER_AUTH_URL` from one deployment, via host routing in `src/proxy.ts`. It is off (today's behavior) when `NEXT_PUBLIC_MARKETING_URL` is unset.

**Architecture:** A pure module `src/lib/host-routing.ts` (`getSplitOrigins`, `getHostKind`, `resolveHostRoute`, `validateSplitConfig`) is unit-tested table-first. `proxy.ts` calls `resolveHostRoute` first. `/`, `robots.ts`, `sitemap.ts`, SEO canonicals and the marketing `metadataBase` read the same module. Session cookies stay host-only; there are no cross-subdomain cookies.

**Tech Stack:** Next.js 16 proxy (`src/proxy.ts`), App Router metadata routes, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-30-domain-split-design.md`

## Global Constraints

- Unset `NEXT_PUBLIC_MARKETING_URL` means **zero behavior change** (the self-hosted and current Vercel deploys must behave exactly as today).
- Redirect targets are built only from configured origins, never from the request `Host`, query or path authority (open-redirect guard).
- Redirects use status **308** (method-preserving).
- Session cookies stay host-only: do not enable BetterAuth `crossSubDomainCookies`.
- Never run `npm run build` (it runs `prisma migrate deploy` against the shared prod DB from `.env`). Use `npx next build`. Dev and E2E servers run with `DATABASE_URL="postgresql://nobody:x@127.0.0.1:1/none?schema=public"`.
- TypeScript strict, no `any`, named exports for new modules. Prettier and ESLint run on commit.
- Commits: `feat:` / `fix:` / `test:` / `docs:` / `chore:`, no Co-Authored-By and no mention of Claude. Branch `feat/domain-split` (off `development`).

## Review Focus

1. **Protocol-relative path on the marketing host** (`//evil.com/x`): the redirect must stay on the app origin (`https://app.example.com//evil.com/x`) and never go to `evil.com`. Tested in Task 1.
2. **Host header with port or uppercase** (`APP.localhost:3000`) must still be classified correctly. Tested in Task 1.
3. **Preview or unknown hosts** (`*.vercel.app`) must pass untouched, so previews keep working as a single host. Tested in Task 1.
4. **Misconfiguration** (same origin for both, `http:` in production, malformed URL, marketing set without `BETTER_AUTH_URL`) must fail fast at startup with a clear error, not silently misroute. Tested in Task 2.
5. **Next dev internals** (`/__nextjs_*`) and the Sentry tunnel (`/monitoring`) on the marketing host must not be redirected, or dev tooling and error reporting break. Tested in Task 1.

---

## File Structure

```
src/lib/host-routing.ts                          CREATE  origins, host kind, route resolution, config validation
src/lib/__tests__/host-routing.test.ts           CREATE  table-driven unit tests
src/lib/url.ts                                   MODIFY  + getMarketingUrl()
src/lib/env-validation.ts                        MODIFY  + NEXT_PUBLIC_MARKETING_URL, cross-field check
src/lib/__tests__/env-validation.test.ts         MODIFY  + split config cases
src/proxy.ts                                     MODIFY  call resolveHostRoute first
src/app/(marketing)/page.tsx                     MODIFY  app host "/" → /dashboard or /login
src/app/(marketing)/layout.tsx                   MODIFY  metadataBase = marketing URL
src/app/robots.ts, src/app/sitemap.ts            MODIFY  per-host / marketing URL
src/lib/seo.ts                                   MODIFY  canonicals from getMarketingUrl()
src/app/__tests__/seo-routes.test.ts             CREATE  robots/sitemap unit tests
tests/e2e/domain-split.spec.ts                   CREATE  host-header E2E (runs when split env set)
playwright.config.js                             MODIFY  marketing project also matches domain-split
.env.example, docs/DEVELOPER_GUIDE.md, docs/DEPLOYMENT.md, CHANGELOG.md, package.json
docs/superpowers/specs/2026-09-30-domain-split-design.md  MODIFY  record the relative-CTA decision
```

---

### Task 1: Host routing core

**Files:**

- Create: `src/lib/host-routing.ts`
- Test: `src/lib/__tests__/host-routing.test.ts`

**Interfaces:**

- Produces:
  - `interface SplitOrigins { marketing: URL; app: URL }`
  - `getSplitOrigins(env?: NodeJS.ProcessEnv): SplitOrigins | null`: returns null when `NEXT_PUBLIC_MARKETING_URL` or `BETTER_AUTH_URL` is unset
  - `type HostKind = "marketing" | "app" | "other"`
  - `getHostKind(host: string | null, origins: SplitOrigins): HostKind`
  - `type HostRoute = { kind: "pass" } | { kind: "redirect"; url: string; status: 308 }`
  - `resolveHostRoute(input: { host: string | null; pathname: string; search: string; origins: SplitOrigins | null }): HostRoute`
  - `MARKETING_PATHS: ReadonlySet<string>`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/__tests__/host-routing.test.ts
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
  ])("marketing host serves %s", (path) =>
    expect(route("example.com", path)).toEqual({ kind: "pass" }),
  );

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
  ])("app host serves %s", (path) =>
    expect(route("app.example.com", path)).toEqual({ kind: "pass" }),
  );

  it("passes unknown hosts (preview deployments) untouched", () => {
    expect(route("asset-tracker-git-x.vercel.app", "/login")).toEqual({
      kind: "pass",
    });
    expect(route("asset-tracker-git-x.vercel.app", "/pricing")).toEqual({
      kind: "pass",
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/__tests__/host-routing.test.ts`
Expected: FAIL, "Cannot find module '@/lib/host-routing'".

- [ ] **Step 3: Implement**

```ts
// src/lib/host-routing.ts
// Host-based split between the marketing site (NEXT_PUBLIC_MARKETING_URL)
// and the app (BETTER_AUTH_URL). Disabled unless both are set.

export interface SplitOrigins {
  marketing: URL;
  app: URL;
}

export type HostKind = "marketing" | "app" | "other";

export type HostRoute =
  { kind: "pass" } | { kind: "redirect"; url: string; status: 308 };

export const MARKETING_PATHS: ReadonlySet<string> = new Set([
  "/",
  "/pricing",
  "/terms",
  "/privacy",
  "/opengraph-image",
  "/sitemap.xml",
  "/robots.txt",
]);

// Marketing pages that live only on the marketing host.
const MARKETING_ONLY_PATHS: ReadonlySet<string> = new Set([
  "/pricing",
  "/terms",
  "/privacy",
  "/sitemap.xml",
]);

const STATIC_FILE = /\.(png|jpg|jpeg|gif|svg|ico|webp)$/;

function alwaysPasses(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/__nextjs") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icons/") ||
    pathname === "/sw.js" ||
    pathname === "/manifest.json" ||
    pathname.startsWith("/api/health") ||
    pathname === "/monitoring" ||
    pathname.startsWith("/monitoring/") ||
    STATIC_FILE.test(pathname)
  );
}

export function getSplitOrigins(
  env: NodeJS.ProcessEnv = process.env,
): SplitOrigins | null {
  const marketing = env.NEXT_PUBLIC_MARKETING_URL;
  const app = env.BETTER_AUTH_URL;
  if (!marketing || !app) return null;
  return { marketing: new URL(marketing), app: new URL(app) };
}

export function getHostKind(
  host: string | null,
  origins: SplitOrigins,
): HostKind {
  const h = (host ?? "").toLowerCase();
  if (h === origins.marketing.host) return "marketing";
  if (h === origins.app.host) return "app";
  return "other";
}

// String concatenation (not new URL(path, base)) so a path like "//evil.com"
// stays a path on the configured origin instead of becoming a new authority.
function redirectTo(origin: URL, pathname: string, search: string): HostRoute {
  return {
    kind: "redirect",
    url: `${origin.origin}${pathname}${search}`,
    status: 308,
  };
}

export function resolveHostRoute(input: {
  host: string | null;
  pathname: string;
  search: string;
  origins: SplitOrigins | null;
}): HostRoute {
  const { host, pathname, search, origins } = input;
  if (!origins || alwaysPasses(pathname)) return { kind: "pass" };

  const kind = getHostKind(host, origins);
  if (kind === "marketing" && !MARKETING_PATHS.has(pathname)) {
    return redirectTo(origins.app, pathname, search);
  }
  if (kind === "app" && MARKETING_ONLY_PATHS.has(pathname)) {
    return redirectTo(origins.marketing, pathname, search);
  }
  return { kind: "pass" };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/__tests__/host-routing.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/host-routing.ts src/lib/__tests__/host-routing.test.ts
git commit -m "feat: add host routing for the marketing/app domain split"
```

---

### Task 2: Config validation and `getMarketingUrl`

**Files:**

- Modify: `src/lib/host-routing.ts` (add `validateSplitConfig`)
- Modify: `src/lib/url.ts` (add `getMarketingUrl`)
- Modify: `src/lib/env-validation.ts` (config entry + cross-field call)
- Test: `src/lib/__tests__/host-routing.test.ts` (append), `src/lib/__tests__/env-validation.test.ts` (append)

**Interfaces:**

- Produces: `validateSplitConfig(env?: NodeJS.ProcessEnv): string | null` (an error message, or null when OK or disabled); `getMarketingUrl(): string` (marketing URL, falling back to `getBaseUrl()`).

- [ ] **Step 1: Write failing tests** (append to `host-routing.test.ts`)

```ts
import { validateSplitConfig } from "@/lib/host-routing";

describe("validateSplitConfig", () => {
  const ok = {
    NEXT_PUBLIC_MARKETING_URL: "https://example.com",
    BETTER_AUTH_URL: "https://app.example.com",
    NODE_ENV: "production",
  } as NodeJS.ProcessEnv;

  it("accepts a valid production config", () =>
    expect(validateSplitConfig(ok)).toBeNull());
  it("is fine when the split is disabled", () =>
    expect(
      validateSplitConfig({ NODE_ENV: "production" } as NodeJS.ProcessEnv),
    ).toBeNull());
  it("requires BETTER_AUTH_URL when the marketing URL is set", () =>
    expect(validateSplitConfig({ ...ok, BETTER_AUTH_URL: undefined })).toMatch(
      /BETTER_AUTH_URL/,
    ));
  it("rejects malformed URLs", () =>
    expect(
      validateSplitConfig({ ...ok, NEXT_PUBLIC_MARKETING_URL: "not a url" }),
    ).toMatch(/valid URL/));
  it("rejects identical origins", () =>
    expect(
      validateSplitConfig({ ...ok, BETTER_AUTH_URL: "https://example.com/" }),
    ).toMatch(/differ/));
  it("rejects http in production", () =>
    expect(
      validateSplitConfig({
        ...ok,
        NEXT_PUBLIC_MARKETING_URL: "http://example.com",
      }),
    ).toMatch(/https/));
  it("allows http in development", () =>
    expect(
      validateSplitConfig({
        NEXT_PUBLIC_MARKETING_URL: "http://localhost:3000",
        BETTER_AUTH_URL: "http://app.localhost:3000",
        NODE_ENV: "development",
      } as NodeJS.ProcessEnv),
    ).toBeNull());
});
```

Append to `src/lib/__tests__/env-validation.test.ts`, matching that file's existing env stubbing pattern (read the top of the file first; if it uses `vi.stubEnv`, use that):

```ts
describe("domain split config", () => {
  it("reports an invalid split as an error", () => {
    vi.stubEnv("NEXT_PUBLIC_MARKETING_URL", "https://example.com");
    vi.stubEnv("BETTER_AUTH_URL", "https://example.com");
    const result = validateEnvironment();
    expect(
      result.errors.some((e) => e.includes("NEXT_PUBLIC_MARKETING_URL")),
    ).toBe(true);
    vi.unstubAllEnvs();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/__tests__/host-routing.test.ts src/lib/__tests__/env-validation.test.ts`
Expected: FAIL (`validateSplitConfig` is not exported; no split error reported).

- [ ] **Step 3: Implement**

Append to `src/lib/host-routing.ts`:

```ts
function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

// Fails fast on a split that would silently misroute (spec §2).
export function validateSplitConfig(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const marketingRaw = env.NEXT_PUBLIC_MARKETING_URL;
  if (!marketingRaw) return null;
  if (!env.BETTER_AUTH_URL) {
    return "NEXT_PUBLIC_MARKETING_URL is set but BETTER_AUTH_URL (the app origin) is not";
  }
  const marketing = parseUrl(marketingRaw);
  const app = parseUrl(env.BETTER_AUTH_URL);
  if (!marketing || !app) {
    return "NEXT_PUBLIC_MARKETING_URL and BETTER_AUTH_URL must each be a valid URL";
  }
  if (marketing.origin === app.origin) {
    return "NEXT_PUBLIC_MARKETING_URL and BETTER_AUTH_URL must differ (marketing vs app host)";
  }
  if (
    env.NODE_ENV === "production" &&
    (marketing.protocol !== "https:" || app.protocol !== "https:")
  ) {
    return "NEXT_PUBLIC_MARKETING_URL and BETTER_AUTH_URL must use https in production";
  }
  return null;
}
```

In `src/lib/url.ts` append:

```ts
/**
 * Public origin of the marketing site. Equals the app URL unless the
 * domain split is enabled (NEXT_PUBLIC_MARKETING_URL).
 */
export function getMarketingUrl(): string {
  return process.env.NEXT_PUBLIC_MARKETING_URL || getBaseUrl();
}
```

In `src/lib/env-validation.ts`:

1. Add `import { validateSplitConfig } from "./host-routing";` at the top.
2. Add an `ENV_CONFIG` entry next to the other URL entries:

```ts
  {
    name: "NEXT_PUBLIC_MARKETING_URL",
    required: false,
    description:
      "Marketing site origin; enables the marketing/app domain split (app stays at BETTER_AUTH_URL)",
  },
```

3. In `validateEnvironment()`, just before `return {`:

```ts
const splitError = validateSplitConfig();
if (splitError) errors.push(splitError);
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/__tests__/host-routing.test.ts src/lib/__tests__/env-validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/host-routing.ts src/lib/url.ts src/lib/env-validation.ts src/lib/__tests__/host-routing.test.ts src/lib/__tests__/env-validation.test.ts
git commit -m "feat: validate the domain split config and expose the marketing URL"
```

---

### Task 3: Proxy integration + E2E

**Files:**

- Modify: `src/proxy.ts`
- Create: `tests/e2e/domain-split.spec.ts`
- Modify: `playwright.config.js` (the `marketing` project `testMatch` gains `domain-split`)

**Interfaces:**

- Consumes: `getSplitOrigins`, `resolveHostRoute` (Task 1).

- [ ] **Step 1: Write the failing E2E test**

```ts
// tests/e2e/domain-split.spec.ts
import { test, expect } from "@playwright/test";

// Runs only against a dev server started with the split enabled:
// NEXT_PUBLIC_MARKETING_URL=http://localhost:3000 BETTER_AUTH_URL=http://app.localhost:3000
const enabled = !!process.env.NEXT_PUBLIC_MARKETING_URL;
const APP_HOST = "app.localhost:3000";

test.describe("domain split", () => {
  test.skip(!enabled, "split not enabled for this run");

  test("marketing host sends /login to the app host", async ({ request }) => {
    const res = await request.get("/login?callbackUrl=%2Fassets", {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(308);
    expect(res.headers().location).toBe(
      `http://${APP_HOST}/login?callbackUrl=%2Fassets`,
    );
  });

  test("marketing host serves the landing page", async ({ request }) => {
    const res = await request.get("/", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
  });

  test("app host sends /pricing to the marketing host", async ({ request }) => {
    const res = await request.get("/pricing", {
      maxRedirects: 0,
      headers: { host: APP_HOST },
    });
    expect(res.status()).toBe(308);
    expect(res.headers().location).toBe("http://localhost:3000/pricing");
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
```

Update `playwright.config.js` marketing project: `testMatch: /(marketing|accessibility|domain-split)\.spec\.ts/`.

- [ ] **Step 2: Start a split-enabled dev server and verify failure**

```bash
NEXT_PUBLIC_MARKETING_URL=http://localhost:3000 BETTER_AUTH_URL=http://app.localhost:3000 DATABASE_URL="postgresql://nobody:x@127.0.0.1:1/none?schema=public" npx next dev --turbopack -p 3000
```

(run it in the background). Then:
Run: `NEXT_PUBLIC_MARKETING_URL=http://localhost:3000 npx playwright test tests/e2e/domain-split.spec.ts --project=marketing --reporter=line`
Expected: the redirect tests FAIL (status 200 or 307 instead of 308). The app-host `/` and robots tests may fail until Task 4, which is expected.

- [ ] **Step 3: Wire the proxy**

In `src/proxy.ts`:

1. Add `import { getSplitOrigins, resolveHostRoute } from "@/lib/host-routing";`.
2. Add a module-level `const splitOrigins = getSplitOrigins();`. Env is fixed per process, and the config is validated at startup by instrumentation.
3. In `proxy()`, right after `withHeaders` and `nextWithNonce` are defined (before `publicRoutes`), insert:

```ts
// Domain split: keep marketing and app on their own hosts (no-op when disabled).
const hostRoute = resolveHostRoute({
  host: req.headers.get("host"),
  pathname,
  search: req.nextUrl.search,
  origins: splitOrigins,
});
if (hostRoute.kind === "redirect") {
  return withHeaders(NextResponse.redirect(hostRoute.url, hostRoute.status));
}
```

- [ ] **Step 4: Run the redirect tests**

Run: `NEXT_PUBLIC_MARKETING_URL=http://localhost:3000 npx playwright test tests/e2e/domain-split.spec.ts --project=marketing --reporter=line -g "sends|serves the landing"`
Expected: PASS (3 tests).

Regression check with the split **disabled**: restart the dev server without `NEXT_PUBLIC_MARKETING_URL`/`BETTER_AUTH_URL` overrides and run `npx playwright test --project=marketing --reporter=line --grep-invert "login page|dashboard page"`.
Expected: all pass and domain-split tests are skipped.

- [ ] **Step 5: Commit**

```bash
git add src/proxy.ts tests/e2e/domain-split.spec.ts playwright.config.js
git commit -m "feat: route requests by host when the domain split is enabled"
```

---

### Task 4: Per-host `/`, robots, sitemap, canonicals

**Files:**

- Modify: `src/app/(marketing)/page.tsx`, `src/app/(marketing)/layout.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts`, `src/lib/seo.ts`
- Test: `src/app/__tests__/seo-routes.test.ts` (create); E2E from Task 3

**Interfaces:**

- Consumes: `getSplitOrigins`, `getHostKind` (Task 1); `getMarketingUrl` (Task 2).

- [ ] **Step 1: Write failing unit tests**

```ts
// src/app/__tests__/seo-routes.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";

const hostHeader = vi.hoisted(() => ({ value: "example.com" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: hostHeader.value }),
}));

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

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
    vi.stubEnv("BETTER_AUTH_URL", "https://assets.example.com");
    const urls = sitemap().map((e) => e.url);
    expect(urls).toContain("https://assets.example.com/login");
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
```

Run: `npx vitest run src/app/__tests__/seo-routes.test.ts`
Expected: FAIL (the sitemap still uses the app URL; robots is not async and not host-aware).

Note: `vitest.config.ts` includes `src/**/*.test.ts`, so this file is picked up.

- [ ] **Step 2: Implement sitemap and robots**

`src/app/sitemap.ts`: replace `getBaseUrl` with `getMarketingUrl` and drop `/register` and `/login` when the split is on:

```ts
import type { MetadataRoute } from "next";
import { getSplitOrigins } from "@/lib/host-routing";
import { getMarketingUrl } from "@/lib/url";

// /login and /register live on the app host once the split is enabled.
const APP_ONLY = new Set(["/register", "/login"]);

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getMarketingUrl();
  const split = getSplitOrigins() !== null;
  const entries: {
    path: string;
    changeFrequency: "weekly" | "monthly" | "yearly";
    priority: number;
  }[] = [
    { path: "", changeFrequency: "weekly", priority: 1.0 },
    { path: "/pricing", changeFrequency: "monthly", priority: 0.8 },
    { path: "/register", changeFrequency: "monthly", priority: 0.6 },
    { path: "/login", changeFrequency: "monthly", priority: 0.5 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  ];
  return entries
    .filter((e) => !(split && APP_ONLY.has(e.path)))
    .map((e) => ({
      url: `${baseUrl}${e.path}`,
      lastModified: new Date(),
      changeFrequency: e.changeFrequency,
      priority: e.priority,
    }));
}
```

`src/app/robots.ts`: make it `async`, and at the top:

```ts
import { headers } from "next/headers";
import { getHostKind, getSplitOrigins } from "@/lib/host-routing";
import { getMarketingUrl } from "@/lib/url";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origins = getSplitOrigins();
  if (origins && getHostKind((await headers()).get("host"), origins) === "app") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  const baseUrl = getMarketingUrl();
  // …existing rules object unchanged…
```

Keep the existing `rules` array as is, and keep `sitemap: \`${baseUrl}/sitemap.xml\``.

- [ ] **Step 3: Canonicals and `metadataBase`**

`src/lib/seo.ts`: in `getCanonicalUrl`, replace `getBaseUrl()` with `getMarketingUrl()` and update the import. Only the marketing pages use `createPageMetadata` (verified with grep), so app pages are unaffected. Check `src/lib/structured-data.ts` for any direct `getBaseUrl()` use and switch it too (`grep -n getBaseUrl src/lib/structured-data.ts`).

`src/app/(marketing)/layout.tsx`: add

```ts
import type { Metadata } from "next";
import { getMarketingUrl } from "@/lib/url";

// Root layout sets metadataBase to the app URL; marketing pages (OG image,
// canonicals) must resolve against the marketing origin.
export const metadata: Metadata = { metadataBase: new URL(getMarketingUrl()) };
```

- [ ] **Step 4: App-host `/`**

In `src/app/(marketing)/page.tsx`, after the existing `if (session?.user) redirect("/dashboard");` block, add:

```ts
// With the domain split, the landing page only renders on the marketing host.
const origins = getSplitOrigins();
if (origins && getHostKind((await headers()).get("host"), origins) === "app") {
  redirect("/login");
}
```

Add the imports `getHostKind` and `getSplitOrigins` from `@/lib/host-routing` (`headers` is already imported).

- [ ] **Step 5: Verify**

Run: `npx vitest run src/app/__tests__/seo-routes.test.ts && npx tsc --noEmit`
Expected: PASS and clean.
With the split-enabled dev server from Task 3 (restart it so env and module state are fresh):
Run: `NEXT_PUBLIC_MARKETING_URL=http://localhost:3000 npx playwright test tests/e2e/domain-split.spec.ts tests/e2e/marketing.spec.ts --project=marketing --reporter=line`
Expected: all domain-split tests pass. The marketing tests also pass on the marketing host (their `/login` and `/register` hrefs stay relative; see the ruling in Task 5).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(marketing)/page.tsx" "src/app/(marketing)/layout.tsx" src/app/robots.ts src/app/sitemap.ts src/lib/seo.ts src/lib/structured-data.ts src/app/__tests__/seo-routes.test.ts
git commit -m "feat: per-host landing, robots, sitemap and canonicals for the domain split"
```

---

### Task 5: Docs, spec sync, version

**Files:**

- Modify: `.env.example`, `docs/DEVELOPER_GUIDE.md`, `docs/DEPLOYMENT.md`, `docs/superpowers/specs/2026-09-30-domain-split-design.md`, `CHANGELOG.md`, `package.json`

- [ ] **Step 1: `.env.example`**, next to `NEXT_PUBLIC_APP_URL`:

```
# Optional: split marketing and app onto separate hosts (same deployment).
# Marketing at NEXT_PUBLIC_MARKETING_URL, app at BETTER_AUTH_URL.
# Leave unset to serve everything from one host (default, and for self-hosting).
# NEXT_PUBLIC_MARKETING_URL=https://example.com
```

- [ ] **Step 2: `docs/DEVELOPER_GUIDE.md`**: append a `## Local Development: Domain Split` section explaining how to set `NEXT_PUBLIC_MARKETING_URL=http://localhost:3000` and `BETTER_AUTH_URL=http://app.localhost:3000` in `.env.local`, that browsers resolve `*.localhost` natively, and how to run `npx playwright test tests/e2e/domain-split.spec.ts --project=marketing` with the split env set.

- [ ] **Step 3: `docs/DEPLOYMENT.md`**: append a `## Domain split rollout` section with the 5 steps from spec §8 verbatim (buy the domain, add apex + `app.` to the Vercel project, set both env vars in production, update the IdP OAuth/SSO redirect URIs and the Stripe webhook to the app host, then Search Console).

- [ ] **Step 4: Spec sync.** In the spec §4, replace the bullet "Marketing CTAs: … `appHref(path)` helper…" with:
      "Marketing CTAs stay relative (`/login`, `/register`). On the marketing host the proxy 308-redirects them to the app host, so no client-side app URL is needed; this costs one redirect hop."
      Also add under §3 rule 2 that `/__nextjs*` passes.

- [ ] **Step 5: Version + changelog.** `package.json` `0.11.0` → `0.12.0`. In `CHANGELOG.md`, insert after the **first** `## [Unreleased]` heading:

```md
## [0.12.0] - YYYY-MM-DD

### Added

- **Optional marketing/app domain split.** Set `NEXT_PUBLIC_MARKETING_URL` to serve the marketing site on its own host while the app stays on `BETTER_AUTH_URL`, from the same deployment. Cross-host requests are 308-redirected, the app host is excluded from indexing, and canonicals, sitemap and OG metadata use the marketing origin. Session cookies stay on the app host. Invalid split config fails at startup. Unset (the default) changes nothing.
```

Use the actual commit date.

- [ ] **Step 6: Full verification and commit**

```bash
npx tsc --noEmit && npm run lint && npm run test:unit
npx playwright test --project=marketing --reporter=line --grep-invert "login page|dashboard page"   # split disabled
DATABASE_URL="postgresql://nobody:x@127.0.0.1:1/none?schema=public" npx next build
git add .env.example docs/DEVELOPER_GUIDE.md docs/DEPLOYMENT.md docs/superpowers/specs/2026-09-30-domain-split-design.md CHANGELOG.md package.json
git commit -m "docs: document the domain split and bump to 0.12.0"
```

Expected: all green.
