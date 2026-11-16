import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");

import { GET, PUT, POST, DELETE } from "@/app/api/dashboard/widgets/route";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import {
  DEFAULT_USER_WIDGETS,
  DEFAULT_WIDGETS,
} from "@/components/dashboard/WidgetRegistry";

const mockPrisma = vi.mocked(prisma, true);

const USER_ID = "user-uuid-001";

function authAs(isAdmin: boolean) {
  vi.mocked(requireApiAuth).mockResolvedValue({
    id: USER_ID,
    isAdmin,
    organizationId: "org-uuid-001",
    orgStatus: "active",
  } as Awaited<ReturnType<typeof requireApiAuth>>);
}

function createdTypes(): string[] {
  return mockPrisma.dashboardWidget.create.mock.calls.map(
    (call) => (call[0] as { data: { widgetType: string } }).data.widgetType,
  );
}

describe("dashboard widgets defaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.dashboardWidget.findMany.mockResolvedValue([]);
    mockPrisma.dashboardWidget.count.mockResolvedValue(0);
  });

  it("GET returns the user default set for non-admins", async () => {
    authAs(false);
    const { body } = await parseResponse<Array<{ widgetType: string }>>(
      await GET(),
    );
    expect(body.map((w) => w.widgetType)).toEqual(
      DEFAULT_USER_WIDGETS.map((w) => w.widgetType),
    );
  });

  it("PUT resolves default-N ids against the user set for non-admins", async () => {
    authAs(false);
    await PUT(
      createMockRequest("/api/dashboard/widgets", {
        method: "PUT",
        body: {
          widgets: [
            { id: "default-0", position: 0, visible: true },
            { id: "default-1", position: 1, visible: false },
          ],
        },
      }),
    );
    expect(createdTypes()).toEqual([
      DEFAULT_USER_WIDGETS[0].widgetType,
      DEFAULT_USER_WIDGETS[1].widgetType,
    ]);
  });

  it("PUT resolves default-N ids against the admin set for admins", async () => {
    authAs(true);
    await PUT(
      createMockRequest("/api/dashboard/widgets", {
        method: "PUT",
        body: { widgets: [{ id: "default-0", position: 0, visible: true }] },
      }),
    );
    expect(createdTypes()).toEqual([DEFAULT_WIDGETS[0].widgetType]);
  });

  it("POST persists the user default set before adding a widget", async () => {
    authAs(false);
    mockPrisma.dashboardWidget.create.mockResolvedValue({ id: "w" } as never);
    const res = await POST(
      createMockRequest("/api/dashboard/widgets", {
        method: "POST",
        body: { widgetType: "stats" },
      }),
    );
    expect(res.status).toBe(201);
    expect(createdTypes().slice(0, DEFAULT_USER_WIDGETS.length)).toEqual(
      DEFAULT_USER_WIDGETS.map((w) => w.widgetType),
    );
  });

  it("DELETE of an unpersisted default persists defaults, then removes it", async () => {
    authAs(false);
    const res = await DELETE(
      createMockRequest("/api/dashboard/widgets?id=default-1", {
        method: "DELETE",
      }),
    );
    const { status } = await parseResponse(res);
    expect(status).toBe(200);
    expect(createdTypes()).toEqual(
      DEFAULT_USER_WIDGETS.map((w) => w.widgetType),
    );
    expect(mockPrisma.dashboardWidget.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        widgetType: DEFAULT_USER_WIDGETS[1].widgetType,
      },
    });
  });

  it("DELETE of a default does not re-create defaults that already exist", async () => {
    authAs(true);
    mockPrisma.dashboardWidget.count.mockResolvedValue(3);
    await DELETE(
      createMockRequest("/api/dashboard/widgets?id=default-0", {
        method: "DELETE",
      }),
    );
    expect(mockPrisma.dashboardWidget.create).not.toHaveBeenCalled();
    expect(mockPrisma.dashboardWidget.deleteMany).toHaveBeenCalled();
  });

  it("DELETE of an out-of-range default id returns 404", async () => {
    authAs(false);
    const { status } = await parseResponse(
      await DELETE(
        createMockRequest("/api/dashboard/widgets?id=default-99", {
          method: "DELETE",
        }),
      ),
    );
    expect(status).toBe(404);
    expect(mockPrisma.dashboardWidget.deleteMany).not.toHaveBeenCalled();
  });
});
