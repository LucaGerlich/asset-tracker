import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Real api-auth guards, so the test proves a locked org's admin can still pay.
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/api-keys", () => ({ validateApiKey: vi.fn() }));
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(),
  PLANS: {
    starter: { priceId: null },
    professional: { priceId: "price_pro" },
    enterprise: { priceId: "price_ent" },
  },
}));

import { POST } from "@/app/api/billing/checkout/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

const mockAuth = vi.mocked(auth, true);
const mockPrisma = vi.mocked(prisma, true);
const mockGetStripe = vi.mocked(getStripe);

const CHECKOUT_URL = "https://checkout.stripe.com/c/pay/test_123";
const createCheckoutSession = vi.fn();

function dbUser(overrides: {
  isadmin?: boolean;
  organization?: { isActive: boolean; suspendedAt: Date | null };
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

function checkoutRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plan: "professional" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SELF_HOSTED;
  delete process.env.DEMO_MODE;
  mockAuth.api.getSession.mockResolvedValue({
    user: { id: "user-1" },
  } as never);
  mockPrisma.user.findUnique.mockResolvedValue(dbUser({}) as never);
  mockPrisma.organization.findUnique.mockResolvedValue({
    id: "org-1",
    name: "Acme",
    stripeCustomerId: "cus_123",
  } as never);
  createCheckoutSession.mockResolvedValue({ url: CHECKOUT_URL });
  mockGetStripe.mockReturnValue({
    checkout: { sessions: { create: createCheckoutSession } },
  } as never);
});

describe("POST /api/billing/checkout", () => {
  it("lets a locked-out org's admin start a checkout", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      dbUser({ organization: { isActive: false, suspendedAt: null } }) as never,
    );

    const response = await POST(checkoutRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: CHECKOUT_URL });
  });

  it("rejects a non-admin with 403 not_admin", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      dbUser({ isadmin: false }) as never,
    );

    const response = await POST(checkoutRequest());

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "not_admin" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated request with 401", async () => {
    mockAuth.api.getSession.mockResolvedValue(null as never);

    const response = await POST(checkoutRequest());

    expect(response.status).toBe(401);
  });
});
