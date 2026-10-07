import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// The real api-auth guards run here (session + org status), because the point
// is that a locked or read-only org's admin still gets through to billing.
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/api-keys", () => ({ validateApiKey: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ getStripe: vi.fn() }));

import { POST } from "@/app/api/billing/portal/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

const mockAuth = vi.mocked(auth, true);
const mockPrisma = vi.mocked(prisma, true);
const mockGetStripe = vi.mocked(getStripe);

const PORTAL_URL = "https://billing.stripe.com/p/session/test_123";
const DAY_MS = 24 * 60 * 60 * 1000;

const createPortalSession = vi.fn();

function dbUser(overrides: {
  isadmin?: boolean;
  organization?: { isActive: boolean; suspendedAt: Date | null } | null;
}) {
  return {
    userid: "user-1",
    username: "jdoe",
    firstname: "Jane",
    lastname: "Doe",
    email: "jane@example.com",
    isadmin: true,
    canrequest: true,
    organizationId: "org-1",
    departmentId: null,
    isActive: true,
    organization: { isActive: true, suspendedAt: null },
    ...overrides,
  };
}

function portalRequest(contentType?: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/billing/portal", {
    method: "POST",
    headers: contentType ? { "content-type": contentType } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SELF_HOSTED;
  mockAuth.api.getSession.mockResolvedValue({
    user: { id: "user-1" },
  } as never);
  mockPrisma.user.findUnique.mockResolvedValue(dbUser({}) as never);
  mockPrisma.organization.findUnique.mockResolvedValue({
    stripeCustomerId: "cus_123",
  } as never);
  createPortalSession.mockResolvedValue({ url: PORTAL_URL });
  mockGetStripe.mockReturnValue({
    billingPortal: { sessions: { create: createPortalSession } },
  } as never);
});

describe("POST /api/billing/portal", () => {
  it("answers a locked-out org's admin with the portal URL as JSON", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      dbUser({ organization: { isActive: false, suspendedAt: null } }) as never,
    );

    const response = await POST(portalRequest("application/json"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: PORTAL_URL });
    expect(createPortalSession).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_123" }),
    );
  });

  it("redirects a locked-out org's admin with a 303 on a form POST", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      dbUser({
        organization: {
          isActive: true,
          suspendedAt: new Date(Date.now() - 30 * DAY_MS),
        },
      }) as never,
    );

    const response = await POST(
      portalRequest("application/x-www-form-urlencoded"),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(PORTAL_URL);
  });

  it("lets a read-only org's admin through", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      dbUser({
        organization: { isActive: true, suspendedAt: new Date() },
      }) as never,
    );

    const response = await POST(portalRequest("application/json"));

    expect(response.status).toBe(200);
  });

  it("rejects a non-admin with 403 not_admin", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      dbUser({ isadmin: false }) as never,
    );

    const response = await POST(portalRequest("application/json"));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "not_admin" });
    expect(createPortalSession).not.toHaveBeenCalled();
  });

  it("rejects a non-admin of a locked org with not_admin, not org_locked", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      dbUser({
        isadmin: false,
        organization: { isActive: false, suspendedAt: null },
      }) as never,
    );

    const response = await POST(portalRequest("application/json"));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "not_admin" });
  });

  it("rejects an unauthenticated request with 401", async () => {
    mockAuth.api.getSession.mockResolvedValue(null as never);

    const response = await POST(portalRequest("application/json"));

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "unauthorized" });
  });

  it("returns 400 when the org has no billing account", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      stripeCustomerId: null,
    } as never);

    const response = await POST(portalRequest("application/json"));

    expect(response.status).toBe(400);
    expect(createPortalSession).not.toHaveBeenCalled();
  });

  it("returns 500 when Stripe fails", async () => {
    createPortalSession.mockRejectedValue(new Error("stripe down"));

    const response = await POST(portalRequest("application/json"));

    expect(response.status).toBe(500);
  });
});
