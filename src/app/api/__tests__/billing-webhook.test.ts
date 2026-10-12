import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(),
  PLANS: {
    starter: { maxAssets: 100, maxUsers: 3, priceId: "price_starter" },
    professional: { maxAssets: 5000, maxUsers: 25, priceId: "price_pro" },
    enterprise: { maxAssets: -1, maxUsers: -1, priceId: "price_ent" },
  },
}));

import { POST } from "@/app/api/billing/webhook/route";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

const mockPrisma = vi.mocked(prisma, true);
const mockGetStripe = vi.mocked(getStripe);
const constructEvent = vi.fn();

function webhookRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/billing/webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=test" },
    body: "{}",
  });
}

/** Make the (mocked) Stripe signature check yield this event. */
function receiveEvent(type: string, object: Record<string, unknown>) {
  constructEvent.mockReturnValue({ type, data: { object } });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  mockGetStripe.mockReturnValue({ webhooks: { constructEvent } } as never);
});

afterEach(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

describe("POST /api/billing/webhook", () => {
  it("rejects a request without a signature", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        body: "{}",
      }),
    );

    expect(response.status).toBe(400);
  });

  describe("checkout.session.completed", () => {
    it("activates the plan and clears the suspension without touching isActive", async () => {
      receiveEvent("checkout.session.completed", {
        subscription: "sub_1",
        metadata: { organizationId: "org-1", plan: "professional" },
      });

      const response = await POST(webhookRequest());

      expect(response.status).toBe(200);
      expect(mockPrisma.organization.update).toHaveBeenCalledTimes(1);
      const args = mockPrisma.organization.update.mock.calls[0][0];
      expect(args.where).toEqual({ id: "org-1" });
      // Stripe does not guarantee event order: when customer.subscription.updated
      // arrives first it finds no org (no subscription id yet) and clears nothing,
      // so the completed event has to clear the billing suspension itself.
      expect(args.data).toEqual({
        plan: "professional",
        stripeSubscriptionId: "sub_1",
        maxAssets: 5000,
        maxUsers: 25,
        suspendedAt: null,
      });
      expect(args.data).not.toHaveProperty("isActive");
    });

    it("ignores a session without organization or a known plan", async () => {
      receiveEvent("checkout.session.completed", {
        subscription: "sub_1",
        metadata: { organizationId: "org-1", plan: "platinum" },
      });

      const response = await POST(webhookRequest());

      expect(response.status).toBe(200);
      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });
  });

  describe("customer.subscription.deleted", () => {
    it("starts the read-only grace period without deactivating the org", async () => {
      receiveEvent("customer.subscription.deleted", { id: "sub_1" });

      const response = await POST(webhookRequest());

      expect(response.status).toBe(200);
      expect(mockPrisma.organization.updateMany).toHaveBeenCalledTimes(1);
      const args = mockPrisma.organization.updateMany.mock.calls[0][0];
      expect(args?.where).toEqual({ stripeSubscriptionId: "sub_1" });
      expect(args?.data).toEqual({
        plan: "starter",
        stripeSubscriptionId: null,
        maxAssets: 100,
        maxUsers: 3,
        suspendedAt: expect.any(Date),
      });
      expect(args?.data).not.toHaveProperty("isActive");
    });
  });

  describe("customer.subscription.updated", () => {
    it("clears the suspension on reactivation without touching isActive", async () => {
      mockPrisma.organization.findFirst.mockResolvedValue({
        id: "org-1",
      } as never);
      receiveEvent("customer.subscription.updated", {
        id: "sub_1",
        status: "active",
        items: { data: [{ price: { id: "price_pro" } }] },
      });

      const response = await POST(webhookRequest());

      expect(response.status).toBe(200);
      expect(mockPrisma.organization.update).toHaveBeenCalledTimes(1);
      const args = mockPrisma.organization.update.mock.calls[0][0];
      expect(args.where).toEqual({ id: "org-1" });
      expect(args.data).toEqual({
        plan: "professional",
        maxAssets: 5000,
        maxUsers: 25,
        suspendedAt: null,
      });
      expect(args.data).not.toHaveProperty("isActive");
    });

    it("leaves the org alone when the subscription is not active", async () => {
      mockPrisma.organization.findFirst.mockResolvedValue({
        id: "org-1",
      } as never);
      receiveEvent("customer.subscription.updated", {
        id: "sub_1",
        status: "past_due",
        items: { data: [{ price: { id: "price_pro" } }] },
      });

      await POST(webhookRequest());

      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });

    it("leaves the org alone for an unknown price", async () => {
      mockPrisma.organization.findFirst.mockResolvedValue({
        id: "org-1",
      } as never);
      receiveEvent("customer.subscription.updated", {
        id: "sub_1",
        status: "active",
        items: { data: [{ price: { id: "price_unknown" } }] },
      });

      await POST(webhookRequest());

      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });
  });
});
