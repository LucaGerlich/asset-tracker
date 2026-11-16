import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockRequest } from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn().mockResolvedValue({
    organization: { id: "org-uuid-001", name: "Test Org" },
  }),
  scopeToOrganization: vi.fn((where: object) => ({
    ...where,
    organizationId: "org-uuid-001",
  })),
}));
vi.mock("@/lib/storage", () => ({
  getStorage: vi.fn(),
  getOrgStorage: vi.fn(),
}));
vi.mock("@/lib/storage/thumbnails", () => ({
  isImageMimeType: vi.fn().mockReturnValue(false),
  generateThumbnails: vi.fn(),
  deleteThumbnails: vi.fn(),
}));

import { POST as postAssetAttachment } from "@/app/api/asset/attachments/route";
import {
  DELETE as deleteAssetAttachment,
  PATCH as patchAssetAttachment,
} from "@/app/api/asset/attachments/[id]/route";
import { POST as postAttachment } from "@/app/api/attachments/route";
import {
  DELETE as deleteAttachment,
  PATCH as patchAttachment,
} from "@/app/api/attachments/[id]/route";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/api-auth";
import { ForbiddenError } from "@/lib/errors";

const mockPrisma = vi.mocked(prisma, true);

const params = { params: Promise.resolve({ id: "att-1" }) };

const denyPermission = () =>
  vi
    .mocked(requirePermission)
    .mockRejectedValue(
      new ForbiddenError("insufficient_permission", "Insufficient permissions"),
    );

const uploadForm = (fields: Record<string, string>) => {
  const form = new FormData();
  form.set("file", new File(["x"], "a.txt", { type: "text/plain" }));
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return new NextRequest("http://localhost:3000/api/attachments", {
    method: "POST",
    body: form,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.organizationStorageConfig.findUnique.mockResolvedValue({
    id: "cfg",
  } as never);
});

describe("asset attachment routes require asset:edit", () => {
  it("POST asks for asset:edit and is denied without it", async () => {
    denyPermission();

    const res = await postAssetAttachment(uploadForm({ assetId: "asset-1" }));

    expect(requirePermission).toHaveBeenCalledWith("asset:edit");
    expect(res.status).toBe(403);
  });

  it("DELETE asks for asset:edit and is denied without it", async () => {
    denyPermission();

    const res = await deleteAssetAttachment(
      createMockRequest("/api/asset/attachments/att-1", { method: "DELETE" }),
      params,
    );

    expect(requirePermission).toHaveBeenCalledWith("asset:edit");
    expect(res.status).toBe(403);
    expect(mockPrisma.asset_attachments.delete).not.toHaveBeenCalled();
  });

  it("PATCH asks for asset:edit and is denied without it", async () => {
    denyPermission();

    const res = await patchAssetAttachment(
      createMockRequest("/api/asset/attachments/att-1", {
        method: "PATCH",
        body: { isPrimary: true },
      }),
      params,
    );

    expect(requirePermission).toHaveBeenCalledWith("asset:edit");
    expect(res.status).toBe(403);
  });
});

describe("entity attachment routes require the entity edit permission", () => {
  it.each([
    ["accessory", "accessory:edit"],
    ["consumable", "consumable:edit"],
    ["component", "component:edit"],
  ])("POST %s upload needs %s", async (entityType, permission) => {
    denyPermission();

    const res = await postAttachment(
      uploadForm({ entityType, entityId: "e-1" }),
    );

    expect(requirePermission).toHaveBeenCalledWith(permission);
    expect(res.status).toBe(403);
  });

  it.each([
    ["accessory", "accessory:edit"],
    ["consumable", "consumable:edit"],
    ["component", "component:edit"],
  ])("DELETE %s attachment needs %s", async (entityType, permission) => {
    denyPermission();

    const res = await deleteAttachment(
      createMockRequest(`/api/attachments/att-1?entityType=${entityType}`, {
        method: "DELETE",
      }),
      params,
    );

    expect(requirePermission).toHaveBeenCalledWith(permission);
    expect(res.status).toBe(403);
  });

  it("PATCH needs the edit permission of the body's entityType", async () => {
    denyPermission();

    const res = await patchAttachment(
      createMockRequest("/api/attachments/att-1", {
        method: "PATCH",
        body: { isPrimary: true, entityType: "component" },
      }),
      params,
    );

    expect(requirePermission).toHaveBeenCalledWith("component:edit");
    expect(res.status).toBe(403);
  });
});
