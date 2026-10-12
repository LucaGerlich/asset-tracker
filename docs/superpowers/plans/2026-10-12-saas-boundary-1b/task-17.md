### Task 17: Navigation follows entitlements

The sidebar and the mobile menu are rendered by client components from a static list, and the session the client holds carries no plan or entitlement data (and must not: BetterAuth caches it for five minutes). Gated entries therefore need a data path: a small authenticated endpoint, `GET /api/entitlements`, and a context provider modelled on `UserPreferencesContext` that fetches it once per user and organization. Items with a `feature` stay hidden until the features are loaded and are shown only when the feature is in the list. Reports has no key: only two of its tabs are gated (Task 16). This is a usability filter; pages and routes enforce their features themselves.

**Files:**

- Create: `src/app/api/entitlements/route.ts`
- Create: `src/contexts/EntitlementsContext.tsx`
- Modify: `src/lib/nav-config.ts`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/MobileNav.tsx`
- Modify: `src/app/layout.tsx`
- Test: `src/app/api/__tests__/entitlements-route.test.ts` (create)
- Test: `src/lib/__tests__/nav-config.test.ts` (create)
- Test: `src/contexts/__tests__/entitlements-context.test.ts` (create; happy-dom, `.ts` with `createElement`)

**Interfaces:**

- Consumes: `requireApiAuth` and `AuthUser.entitlements` (Task 6); `getEffectiveEntitlements` (Task 6); `isBillingEnabled` (Task 2); `GATED_FEATURES`, `GatedFeature` (`entitlements-shared`); `stubCloudMode` (Task 2); `useSession` from `@/lib/auth-client`.
- Produces `GET /api/entitlements` -> `{ features: GatedFeature[]; billingEnabled: boolean }` (`requireApiAuth`, `Cache-Control: no-store`, errors through `apiErrorResponse`, no limits and no plan data in the body). The features come from `user.entitlements` (loaded with the user, no extra query) and fall back to `getEffectiveEntitlements(user.organizationId ?? null)` for hand-built users.
- Produces in `src/contexts/EntitlementsContext.tsx`: `EntitlementsProvider`, `useEntitlements(): { features: readonly GatedFeature[] | null; billingEnabled: boolean }` (`null` until loaded, also after a refusal, an error or a sign-out; refetched when the session user or organization changes), plus the pure `parseEntitlementsResponse(data: unknown)` and the type `EntitlementsValue`.
- Produces in `src/lib/nav-config.ts`: `NavItem.feature?: GatedFeature` and `filterSectionsForUser(sections: NavSection[], isAdmin: boolean, features: readonly GatedFeature[] | null): NavSection[]` (items with a `feature` are hidden unless it is in `features`; `null` hides them; admin-only items still need an admin). Keys: Procurement -> `procurement`, TCO Analysis -> `tco_dashboard`, Workflows -> `workflow_automation`; Reports has none.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/nav-config.test.ts`. The filter is pure, so the cases include the unloaded state, the admin rule that still applies, and that unchanged sections keep their identity.

```ts
import { describe, it, expect } from "vitest";
import { Boxes } from "lucide-react";
import {
  filterSectionsForUser,
  navSections,
  type NavItem,
  type NavSection,
} from "@/lib/nav-config";
import { GATED_FEATURES } from "@/lib/entitlements-shared";

function itemAt(href: string): NavItem {
  const item = navSections
    .flatMap((section) => section.items)
    .find((candidate) => candidate.href === href);
  if (!item) throw new Error(`no nav item for ${href}`);
  return item;
}

function hrefs(sections: NavSection[]): string[] {
  return sections.flatMap((section) => section.items.map((item) => item.href));
}

describe("navSections feature keys", () => {
  it.each([
    ["/procurement", "procurement"],
    ["/tco", "tco_dashboard"],
    ["/admin/workflows", "workflow_automation"],
  ])("gates %s on %s", (href, feature) => {
    expect(itemAt(href).feature).toBe(feature);
  });

  it("leaves Reports ungated: only two of its tabs need a feature", () => {
    expect(itemAt("/reports").feature).toBeUndefined();
  });

  it("only uses known features", () => {
    for (const section of navSections) {
      for (const item of section.items) {
        if (item.feature) expect(GATED_FEATURES).toContain(item.feature);
      }
    }
  });
});

describe("filterSectionsForUser with features", () => {
  it("hides every gated item while the features are not loaded", () => {
    const visible = hrefs(filterSectionsForUser(navSections, true, null));

    expect(visible).not.toContain("/procurement");
    expect(visible).not.toContain("/tco");
    expect(visible).not.toContain("/admin/workflows");
    expect(visible).toContain("/reports");
    expect(visible).toContain("/assets");
  });

  it("shows exactly the gated items whose feature the organization has", () => {
    const visible = hrefs(
      filterSectionsForUser(navSections, true, ["tco_dashboard"]),
    );

    expect(visible).toContain("/tco");
    expect(visible).not.toContain("/procurement");
    expect(visible).not.toContain("/admin/workflows");
  });

  it("shows everything to an admin of an organization with every feature", () => {
    const visible = hrefs(
      filterSectionsForUser(navSections, true, [...GATED_FEATURES]),
    );

    expect(visible).toEqual(hrefs(navSections));
  });

  it("keeps admin-only items hidden from a non-admin whatever the features", () => {
    const visible = hrefs(
      filterSectionsForUser(navSections, false, [...GATED_FEATURES]),
    );

    expect(visible).not.toContain("/procurement");
    expect(visible).not.toContain("/tco");
    expect(visible).not.toContain("/user");
    expect(visible).toContain("/assets");
  });

  it("still hides admin-only items from a non-admin while features are null", () => {
    const visible = hrefs(filterSectionsForUser(navSections, false, null));

    expect(visible).not.toContain("/user");
    expect(visible).toContain("/dashboard");
  });

  it("drops a section whose items are all hidden and keeps untouched sections as they are", () => {
    const open: NavItem = { label: "Assets", href: "/assets", icon: Boxes };
    const gated: NavItem = {
      label: "Procurement",
      href: "/procurement",
      icon: Boxes,
      feature: "procurement",
    };
    const sections: NavSection[] = [
      { title: "Open", items: [open] },
      { title: "Gated only", items: [gated] },
      { title: "Mixed", items: [open, gated] },
    ];

    const result = filterSectionsForUser(sections, true, null);

    expect(result.map((section) => section.title)).toEqual(["Open", "Mixed"]);
    expect(result[0]).toBe(sections[0]);
    expect(result[1].items).toEqual([open]);
  });
});
```

Create `src/app/api/__tests__/entitlements-route.test.ts`. The api-auth automock supplies an admin without `entitlements`, which exercises the fallback; tests that give the user entitlements exercise the primary path. `billingEnabled` is checked against the real `isBillingEnabled` with environment stubs.

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { stubCloudMode } from "../../../../tests/setup/cloud-mode";

vi.mock("@/lib/api-auth");
vi.mock("@/lib/entitlements", () => ({ getEffectiveEntitlements: vi.fn() }));
vi.mock("@/lib/logger");

import { GET } from "@/app/api/entitlements/route";
import { requireApiAuth } from "@/lib/api-auth";
import { getEffectiveEntitlements } from "@/lib/entitlements";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { UNRESTRICTED } from "@/lib/entitlements-shared";

const mockRequireApiAuth = vi.mocked(requireApiAuth);
const mockGetEffective = vi.mocked(getEffectiveEntitlements);

const authUser = {
  id: "admin-uuid-001",
  isAdmin: true,
  organizationId: "org-uuid-001",
  orgStatus: "active" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireApiAuth.mockResolvedValue(authUser as never);
  mockGetEffective.mockResolvedValue(UNRESTRICTED);
  vi.stubEnv("BILLING_URL", "");
  vi.stubEnv("STRIPE_SECRET_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/entitlements", () => {
  it("answers 401 without a session", async () => {
    mockRequireApiAuth.mockRejectedValue(new UnauthorizedError());

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "unauthorized" });
  });

  it("answers 403 for a locked-out organization", async () => {
    mockRequireApiAuth.mockRejectedValue(
      new ForbiddenError("org_locked", "Organization suspended"),
    );

    const response = await GET();

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "org_locked" });
  });

  it("returns the features loaded with the user without another read", async () => {
    mockRequireApiAuth.mockResolvedValue({
      ...authUser,
      entitlements: { features: ["procurement"], maxAssets: 5, maxUsers: 2 },
    } as never);

    const response = await GET();

    expect(response.status).toBe(200);
    expect((await response.json()).features).toEqual(["procurement"]);
    expect(mockGetEffective).not.toHaveBeenCalled();
  });

  it("reads the organization's entitlements when the user carries none", async () => {
    mockGetEffective.mockResolvedValue({
      features: ["tco_dashboard"],
      maxAssets: null,
      maxUsers: null,
    });

    const response = await GET();

    expect((await response.json()).features).toEqual(["tco_dashboard"]);
    expect(mockGetEffective).toHaveBeenCalledWith("org-uuid-001");
  });

  it("reads the entitlements of an organization-less user with a null id", async () => {
    mockRequireApiAuth.mockResolvedValue({
      ...authUser,
      organizationId: undefined,
    } as never);

    await GET();

    expect(mockGetEffective).toHaveBeenCalledWith(null);
  });

  it("answers an organization without features with an empty list", async () => {
    mockGetEffective.mockResolvedValue({
      features: [],
      maxAssets: 100,
      maxUsers: 3,
    });

    const response = await GET();

    expect(await response.json()).toMatchObject({ features: [] });
  });

  it("is not cacheable", async () => {
    const response = await GET();

    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("exposes features and billingEnabled only: no limits, no plan data", async () => {
    mockRequireApiAuth.mockResolvedValue({
      ...authUser,
      entitlements: { features: ["scim"], maxAssets: 1, maxUsers: 1 },
    } as never);

    const body = await (await GET()).json();

    expect(Object.keys(body).sort()).toEqual(["billingEnabled", "features"]);
  });

  describe("billingEnabled", () => {
    it("is true in cloud mode with BILLING_URL", async () => {
      stubCloudMode();
      vi.stubEnv("BILLING_URL", "https://billing.example.com");

      expect((await (await GET()).json()).billingEnabled).toBe(true);
    });

    it("is true in cloud mode while legacy billing is active", async () => {
      stubCloudMode();
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");

      expect((await (await GET()).json()).billingEnabled).toBe(true);
    });

    it("is false in cloud mode without billing", async () => {
      stubCloudMode();

      expect((await (await GET()).json()).billingEnabled).toBe(false);
    });

    it("is false outside cloud mode even with BILLING_URL and Stripe set", async () => {
      vi.stubEnv("BILLING_URL", "https://billing.example.com");
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");

      expect((await (await GET()).json()).billingEnabled).toBe(false);
    });
  });

  it("answers 500 with a generic body when something unexpected fails", async () => {
    mockGetEffective.mockRejectedValue(
      new Error("connection to db.internal:5432 refused"),
    );

    const response = await GET();
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(JSON.parse(text)).toEqual({
      error: "Failed to load entitlements",
      code: "internal_error",
    });
    expect(text).not.toContain("db.internal");
  });
});
```

Create `src/contexts/__tests__/entitlements-context.test.ts`. It renders the real provider into happy-dom with a mocked `useSession` and a mocked `fetch`; the docblock on the first line selects the environment, so nothing may precede it.

```ts
// @vitest-environment happy-dom
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

vi.mock("@/lib/auth-client", () => ({ useSession: vi.fn() }));

import {
  EntitlementsProvider,
  parseEntitlementsResponse,
  useEntitlements,
} from "@/contexts/EntitlementsContext";
import { useSession } from "@/lib/auth-client";

const mockUseSession = vi.mocked(useSession);
const fetchMock = vi.fn();

type Session = ReturnType<typeof useSession>;

function sessionOf(
  user: { id: string; organizationId?: string } | null,
  isPending = false,
): Session {
  return { data: user ? { user } : null, isPending } as unknown as Session;
}

function Probe() {
  const { features, billingEnabled } = useEntitlements();
  return createElement(
    "p",
    { id: "probe" },
    JSON.stringify({ features, billingEnabled }),
  );
}

let container: HTMLElement;
let root: Root;

async function render(): Promise<void> {
  await act(async () => {
    root.render(
      createElement(EntitlementsProvider, null, createElement(Probe)),
    );
  });
}

function probe(): { features: string[] | null; billingEnabled: boolean } {
  return JSON.parse(container.querySelector("#probe")?.textContent ?? "null");
}

function respondWith(body: unknown, ok = true): void {
  fetchMock.mockResolvedValueOnce({ ok, json: async () => body });
}

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  mockUseSession.mockReturnValue(sessionOf({ id: "u1", organizationId: "o1" }));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("parseEntitlementsResponse", () => {
  it("reads features and billingEnabled", () => {
    expect(
      parseEntitlementsResponse({
        features: ["procurement"],
        billingEnabled: true,
      }),
    ).toEqual({ features: ["procurement"], billingEnabled: true });
  });

  it("drops unknown features and keeps the known ones in a stable order", () => {
    expect(
      parseEntitlementsResponse({
        features: ["tco_dashboard", "white_label", "api_keys"],
        billingEnabled: false,
      }),
    ).toEqual({
      features: ["api_keys", "tco_dashboard"],
      billingEnabled: false,
    });
  });

  it("treats a non-true billingEnabled as false", () => {
    expect(
      parseEntitlementsResponse({ features: [], billingEnabled: "yes" }),
    ).toEqual({ features: [], billingEnabled: false });
  });

  it.each([null, undefined, "x", 3, {}, { features: "api_keys" }])(
    "rejects %j",
    (data) => {
      expect(parseEntitlementsResponse(data)).toBeNull();
    },
  );
});

describe("useEntitlements", () => {
  it("is not loaded outside a provider", async () => {
    await act(async () => {
      root.render(createElement(Probe));
    });

    expect(probe()).toEqual({ features: null, billingEnabled: false });
  });
});

describe("EntitlementsProvider", () => {
  it("stays not loaded until the response arrives, then exposes the features", async () => {
    let resolve: (value: unknown) => void = () => {};
    fetchMock.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );

    await render();
    expect(probe().features).toBeNull();

    await act(async () => {
      resolve({
        ok: true,
        json: async () => ({ features: ["procurement"], billingEnabled: true }),
      });
    });

    expect(probe()).toEqual({
      features: ["procurement"],
      billingEnabled: true,
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/entitlements", {
      cache: "no-store",
    });
  });

  it("stays not loaded when the server refuses", async () => {
    respondWith({ error: "Forbidden", code: "org_locked" }, false);

    await render();

    expect(probe()).toEqual({ features: null, billingEnabled: false });
  });

  it("stays not loaded when the request fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));

    await render();

    expect(probe().features).toBeNull();
  });

  it("does not fetch while the session is pending or signed out", async () => {
    mockUseSession.mockReturnValue(sessionOf(null, true));
    await render();
    mockUseSession.mockReturnValue(sessionOf(null));
    await render();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(probe().features).toBeNull();
  });

  it("fetches once per user and organization, not once per render", async () => {
    respondWith({ features: ["api_keys"], billingEnabled: false });

    await render();
    await render();
    await render();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(probe().features).toEqual(["api_keys"]);
  });

  it("refetches when another user signs in and hides the previous user's features meanwhile", async () => {
    respondWith({ features: ["procurement"], billingEnabled: false });
    await render();
    expect(probe().features).toEqual(["procurement"]);

    let resolve: (value: unknown) => void = () => {};
    fetchMock.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );
    mockUseSession.mockReturnValue(
      sessionOf({ id: "u2", organizationId: "o1" }),
    );
    await render();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(probe().features).toBeNull();

    await act(async () => {
      resolve({
        ok: true,
        json: async () => ({ features: ["scim"], billingEnabled: false }),
      });
    });
    expect(probe().features).toEqual(["scim"]);
  });

  it("refetches when the user moves to another organization", async () => {
    respondWith({ features: ["procurement"], billingEnabled: false });
    await render();

    respondWith({ features: [], billingEnabled: false });
    mockUseSession.mockReturnValue(
      sessionOf({ id: "u1", organizationId: "o2" }),
    );
    await render();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(probe().features).toEqual([]);
  });

  it("forgets the features on sign-out", async () => {
    respondWith({ features: ["procurement"], billingEnabled: false });
    await render();
    expect(probe().features).toEqual(["procurement"]);

    mockUseSession.mockReturnValue(sessionOf(null));
    await render();

    expect(probe()).toEqual({ features: null, billingEnabled: false });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/nav-config.test.ts src/app/api/__tests__/entitlements-route.test.ts src/contexts/__tests__/entitlements-context.test.ts`
Expected: FAIL. `nav-config.test.ts` fails (no `feature` keys, and `filterSectionsForUser` ignores its third argument); the route and context tests cannot load `@/app/api/entitlements/route` and `@/contexts/EntitlementsContext`.

- [ ] **Step 3: Write the endpoint**

Create `src/app/api/entitlements/route.ts`. A locked-out organization gets `org_locked` from `requireApiAuth`; the client then keeps the gated entries hidden, and the proxy sends such users to `/suspended` anyway.

```ts
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { isBillingEnabled } from "@/lib/deployment-mode";
import { getEffectiveEntitlements } from "@/lib/entitlements";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * The feature set of the caller's organization, for the navigation. It carries
 * no limits and no plan data. Hiding a link is a usability filter only: every
 * route and page enforces its feature on its own.
 */
export async function GET() {
  try {
    const user = await requireApiAuth();
    const entitlements =
      user.entitlements ??
      (await getEffectiveEntitlements(user.organizationId ?? null));

    return NextResponse.json(
      {
        features: entitlements.features,
        billingEnabled: isBillingEnabled(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("GET /api/entitlements error", { error });
    return NextResponse.json(
      { error: "Failed to load entitlements", code: "internal_error" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Write the provider**

Create `src/contexts/EntitlementsContext.tsx`. The loaded value is stored with the key of the user and organization it belongs to, so a different user never sees the previous one's features while the new request is in flight, and nothing is set synchronously inside the effect (the `react-hooks` rules of this repo forbid it). Unknown feature names from a newer server are dropped.

```tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useSession, type SessionUser } from "@/lib/auth-client";
import { GATED_FEATURES, type GatedFeature } from "@/lib/entitlements-shared";

export interface EntitlementsValue {
  /** The features of the viewer's organization; null until they are loaded. */
  features: readonly GatedFeature[] | null;
  billingEnabled: boolean;
}

const NOT_LOADED: EntitlementsValue = { features: null, billingEnabled: false };

const EntitlementsContext = createContext<EntitlementsValue>(NOT_LOADED);

/**
 * Reads GET /api/entitlements. Unknown feature names are dropped, so a newer
 * server never breaks an older client; anything malformed counts as not loaded.
 */
export function parseEntitlementsResponse(
  data: unknown,
): EntitlementsValue | null {
  if (typeof data !== "object" || data === null) return null;
  const { features, billingEnabled } = data as Record<string, unknown>;
  if (!Array.isArray(features)) return null;
  return {
    features: GATED_FEATURES.filter((feature) => features.includes(feature)),
    billingEnabled: billingEnabled === true,
  };
}

async function fetchEntitlements(): Promise<EntitlementsValue> {
  try {
    const res = await fetch("/api/entitlements", { cache: "no-store" });
    if (!res.ok) return NOT_LOADED;
    return parseEntitlementsResponse(await res.json()) ?? NOT_LOADED;
  } catch {
    // Offline or a server error: keep the gated navigation hidden.
    return NOT_LOADED;
  }
}

interface LoadedEntitlements {
  /** Whose entitlements these are: a different user or organization invalidates them. */
  key: string;
  value: EntitlementsValue;
}

export function EntitlementsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();
  const user = session?.user as SessionUser | undefined;
  const key = user ? `${user.id}:${user.organizationId ?? ""}` : null;
  const [loaded, setLoaded] = useState<LoadedEntitlements | null>(null);

  useEffect(() => {
    if (isPending || key === null) return;

    let cancelled = false;
    void fetchEntitlements().then((value) => {
      if (!cancelled) setLoaded({ key, value });
    });

    return () => {
      cancelled = true;
    };
  }, [isPending, key]);

  const value = key !== null && loaded?.key === key ? loaded.value : NOT_LOADED;

  return (
    <EntitlementsContext.Provider value={value}>
      {children}
    </EntitlementsContext.Provider>
  );
}

export function useEntitlements(): EntitlementsValue {
  return useContext(EntitlementsContext);
}
```

- [ ] **Step 5: Give the navigation its feature keys**

In `src/lib/nav-config.ts`, add the field to `NavItem`.

Replace:

```ts
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  adminOnly?: boolean;
}
```

With:

```ts
import type { LucideIcon } from "lucide-react";
import type { GatedFeature } from "@/lib/entitlements-shared";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  adminOnly?: boolean;
  /** Shown only to organizations that have the feature (hidden while the features load). */
  feature?: GatedFeature;
}
```

In `src/lib/nav-config.ts`, key the Procurement item.

Replace:

```ts
      {
        label: "Procurement",
        href: "/procurement",
        icon: ShoppingCart,
        adminOnly: true,
      },
```

With:

```ts
      {
        label: "Procurement",
        href: "/procurement",
        icon: ShoppingCart,
        adminOnly: true,
        feature: "procurement",
      },
```

In `src/lib/nav-config.ts`, key the TCO Analysis and Workflows items.

Replace:

```ts
      {
        label: "TCO Analysis",
        href: "/tco",
        icon: BarChart3,
        adminOnly: true,
      },
      {
        label: "Workflows",
        href: "/admin/workflows",
        icon: Zap,
        adminOnly: true,
      },
```

With:

```ts
      {
        label: "TCO Analysis",
        href: "/tco",
        icon: BarChart3,
        adminOnly: true,
        feature: "tco_dashboard",
      },
      {
        label: "Workflows",
        href: "/admin/workflows",
        icon: Zap,
        adminOnly: true,
        feature: "workflow_automation",
      },
```

In `src/lib/nav-config.ts`, replace the filter.

Replace:

```ts
export function filterSectionsForUser(
  sections: NavSection[],
  isAdmin: boolean,
): NavSection[] {
  if (isAdmin) return sections;
  return sections.reduce<NavSection[]>((acc, section) => {
    if (!section.items.some((item) => item.adminOnly)) {
      acc.push(section);
      return acc;
    }
    const filtered = section.items.filter((item) => !item.adminOnly);
    if (filtered.length > 0) acc.push({ ...section, items: filtered });
    return acc;
  }, []);
}
```

With:

```ts
/**
 * The sections a viewer sees: admin-only items need an admin, and items with a
 * `feature` need it in `features`. `null` means the features are not loaded yet,
 * which hides every gated item. This is a usability filter only: the pages and
 * routes behind the links enforce their feature themselves.
 */
export function filterSectionsForUser(
  sections: NavSection[],
  isAdmin: boolean,
  features: readonly GatedFeature[] | null,
): NavSection[] {
  const isVisible = (item: NavItem): boolean => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.feature)
      return features !== null && features.includes(item.feature);
    return true;
  };
  return sections.reduce<NavSection[]>((acc, section) => {
    const items = section.items.filter(isVisible);
    if (items.length === section.items.length) {
      acc.push(section);
    } else if (items.length > 0) {
      acc.push({ ...section, items });
    }
    return acc;
  }, []);
}
```

- [ ] **Step 6: Feed the entitlements to both menus**

In `src/components/Sidebar.tsx`, import the hook.

Replace:

```tsx
import { useSession, signOut, type SessionUser } from "@/lib/auth-client";
import { clearQueueOnSignOut } from "@/lib/offline-queue";
import {
  navSections,
  isActivePath,
  filterSectionsForUser,
} from "@/lib/nav-config";
```

With:

```tsx
import { useSession, signOut, type SessionUser } from "@/lib/auth-client";
import { useEntitlements } from "@/contexts/EntitlementsContext";
import { clearQueueOnSignOut } from "@/lib/offline-queue";
import {
  navSections,
  isActivePath,
  filterSectionsForUser,
} from "@/lib/nav-config";
```

In `src/components/Sidebar.tsx`, pass the features to the filter.

Replace:

```tsx
const isAdmin = !!user?.isadmin;

const filteredSections = useMemo(
  () => (isPending ? [] : filterSectionsForUser(navSections, isAdmin)),
  [isAdmin, isPending],
);
```

With:

```tsx
const isAdmin = !!user?.isadmin;
const { features } = useEntitlements();

const filteredSections = useMemo(
  () =>
    isPending ? [] : filterSectionsForUser(navSections, isAdmin, features),
  [isAdmin, isPending, features],
);
```

In `src/components/MobileNav.tsx`, import the hook.

Replace:

```tsx
import { useSession, signOut, type SessionUser } from "@/lib/auth-client";
import { clearQueueOnSignOut } from "@/lib/offline-queue";
```

With:

```tsx
import { useSession, signOut, type SessionUser } from "@/lib/auth-client";
import { useEntitlements } from "@/contexts/EntitlementsContext";
import { clearQueueOnSignOut } from "@/lib/offline-queue";
```

In `src/components/MobileNav.tsx`, pass the features to the filter.

Replace:

```tsx
const isAdmin = !!user?.isadmin;

const filteredSections = useMemo(
  () => (isPending ? [] : filterSectionsForUser(navSections, isAdmin)),
  [isAdmin, isPending],
);
```

With:

```tsx
const isAdmin = !!user?.isadmin;
const { features } = useEntitlements();

const filteredSections = useMemo(
  () =>
    isPending ? [] : filterSectionsForUser(navSections, isAdmin, features),
  [isAdmin, isPending, features],
);
```

- [ ] **Step 7: Mount the provider**

The provider sits inside `UserPreferencesProvider` in the root layout; it fetches nothing for signed-out visitors.

In `src/app/layout.tsx`, import the provider.

Replace:

```tsx
import { UserPreferencesProvider } from "../contexts/UserPreferencesContext";
```

With:

```tsx
import { UserPreferencesProvider } from "../contexts/UserPreferencesContext";
import { EntitlementsProvider } from "../contexts/EntitlementsContext";
```

In `src/app/layout.tsx`, wrap the existing tree.

Replace:

```tsx
<UserPreferencesProvider>
  <Providers nonce={nonce}>
    <AppShell
      initialSidebarCollapsed={initialSidebarCollapsed}
      isDemo={isDemo}
      initialPathname={pathname}
    >
      {children}
    </AppShell>
    <PWAInstallPrompt />
    <Toaster richColors />
  </Providers>
</UserPreferencesProvider>
```

With:

```tsx
<UserPreferencesProvider>
  <EntitlementsProvider>
    <Providers nonce={nonce}>
      <AppShell
        initialSidebarCollapsed={initialSidebarCollapsed}
        isDemo={isDemo}
        initialPathname={pathname}
      >
        {children}
      </AppShell>
      <PWAInstallPrompt />
      <Toaster richColors />
    </Providers>
  </EntitlementsProvider>
</UserPreferencesProvider>
```

- [ ] **Step 8: Run the tests, the type check, the linter and the whole suite**

Run: `npx vitest run src/lib/__tests__/nav-config.test.ts src/app/api/__tests__/entitlements-route.test.ts src/contexts/__tests__/entitlements-context.test.ts src/app/api/__tests__/route-conventions.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit -p .` and `npx eslint src/app/api/entitlements/route.ts src/contexts src/lib/nav-config.ts src/components/Sidebar.tsx src/components/MobileNav.tsx src/app/layout.tsx src/lib/__tests__/nav-config.test.ts src/app/api/__tests__/entitlements-route.test.ts`
Expected: no errors.

The task changed the root layout and both menus: run `npx vitest run`.
Expected: all pass (DB tests skipped locally).

- [ ] **Step 9: Commit**

```bash
git add src/app/api/entitlements/route.ts src/contexts src/lib/nav-config.ts src/components/Sidebar.tsx src/components/MobileNav.tsx src/app/layout.tsx src/lib/__tests__/nav-config.test.ts src/app/api/__tests__/entitlements-route.test.ts
git commit -m "feat: hide navigation entries for features the organization lacks"
```
