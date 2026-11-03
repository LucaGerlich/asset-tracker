import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

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

import { POST } from "@/app/api/labels/pdf/route";
import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma, true);

const ASSET_ID = "22222222-2222-4222-8222-222222222222";

const template = (layout: string) =>
  ({
    id: "tpl",
    width: 3,
    height: 2,
    layout,
    fields: '["assetName"]',
    isDefault: true,
  }) as never;

const asset = (assetname: string) =>
  ({
    assetid: ASSET_ID,
    assetname,
    assettag: "TAG-1",
    serialnumber: "SN-1",
    manufacturer: null,
    model: null,
    location: null,
    assetCategoryType: null,
    statusType: null,
    purchasedate: null,
    purchaseprice: null,
  }) as never;

const post = (body: Record<string, unknown>) =>
  POST(createMockRequest("/api/labels/pdf", { method: "POST", body }));

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.label_templates.findFirst.mockResolvedValue(
    template("{{assetName}}\n{{assetTag}}"),
  );
  mockPrisma.asset.findMany.mockResolvedValue([asset("Laptop")]);
});

describe("POST /api/labels/pdf input validation", () => {
  it.each([
    ["a non-array assetIds", { assetIds: "abc" }],
    ["an empty assetIds", { assetIds: [] }],
    ["non-uuid ids", { assetIds: ["not-a-uuid"] }],
    ["non-string ids", { assetIds: [{ $ne: null }] }],
    [
      "more than 200 ids",
      {
        assetIds: Array.from({ length: 201 }, () => ASSET_ID),
      },
    ],
    ["a non-uuid templateId", { assetIds: [ASSET_ID], templateId: "x" }],
  ])("rejects %s", async (_label, body) => {
    const { status } = await parseResponse(await post(body));

    expect(status).toBe(400);
    expect(mockPrisma.asset.findMany).not.toHaveBeenCalled();
  });

  it("accepts exactly 200 ids", async () => {
    const res = await post({
      assetIds: Array.from({ length: 200 }, () => ASSET_ID),
    });

    expect(res.status).toBe(200);
  });
});

describe("POST /api/labels/pdf text encoding", () => {
  it.each([
    ["CJK characters", "日本語ラベル"],
    ["emoji", "Laptop 💻"],
    ["a newline inside a value", "Line one\nLine two"],
    ["a WinAnsi-only character", "Preis 10 € – “quoted”"],
  ])("renders a label whose asset name has %s", async (_label, name) => {
    mockPrisma.asset.findMany.mockResolvedValue([asset(name)]);

    const res = await post({ assetIds: [ASSET_ID] });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("renders legacy field-mode labels with non-Latin values", async () => {
    mockPrisma.label_templates.findFirst.mockResolvedValue(template(""));
    mockPrisma.asset.findMany.mockResolvedValue([asset("日本語")]);

    const res = await post({ assetIds: [ASSET_ID] });

    expect(res.status).toBe(200);
  });
});
