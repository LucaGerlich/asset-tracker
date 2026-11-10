import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn().mockResolvedValue(null),
  scopeToOrganization: vi.fn().mockReturnValue({}),
}));
vi.mock("@/lib/streaming-export", () => ({
  buildStreamingCsvResponse: vi.fn(() => new Response("ok", { status: 200 })),
}));

import { GET } from "@/app/api/export/route";
import { requirePermission } from "@/lib/api-auth";
import { ForbiddenError } from "@/lib/errors";
import { createMockRequest } from "../../../../tests/setup/test-helpers";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/export permissions", () => {
  it.each([
    ["assets", "asset:view"],
    ["users", "user:view"],
    ["licences", "license:view"],
    ["accessories", "accessory:view"],
    ["consumables", "consumable:view"],
    ["depreciation", "asset:view"],
  ])("requires %s export to hold %s", async (entity, permission) => {
    const res = await GET(
      createMockRequest(`/api/export?entity=${entity}&format=csv`),
    );

    expect(res.status).toBe(200);
    expect(requirePermission).toHaveBeenCalledWith(permission);
  });

  it("returns 403 when the caller lacks the entity permission", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(
      new ForbiddenError("insufficient_permission", "Insufficient permissions"),
    );

    const res = await GET(createMockRequest("/api/export?entity=users"));

    expect(res.status).toBe(403);
  });

  it("rejects an unknown entity without checking permissions", async () => {
    const res = await GET(createMockRequest("/api/export?entity=bogus"));

    expect(res.status).toBe(400);
  });
});
