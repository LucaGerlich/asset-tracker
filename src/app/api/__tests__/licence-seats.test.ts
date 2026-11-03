import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { ASSIGN: "ASSIGN", CREATE: "CREATE" },
  AUDIT_ENTITIES: { LICENCE_SEAT: "LICENCE_SEAT", KIT: "KIT" },
}));
vi.mock("@/lib/webhooks", () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/integrations/slack-teams", () => ({
  notifyIntegrations: vi.fn().mockResolvedValue(undefined),
}));

import { POST as assignSeat } from "@/app/api/licence/seats/route";
import { POST as checkoutKit } from "@/app/api/kits/[id]/checkout/route";
import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma, true);

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const LICENCE_ID = uuid(1);
const USER_ID = uuid(2);
const KIT_ID = uuid(3);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/licence/seats", () => {
  const post = () =>
    assignSeat(
      createMockRequest("/api/licence/seats", {
        method: "POST",
        body: { licenceId: LICENCE_ID, userId: USER_ID },
      }),
    );

  beforeEach(() => {
    mockPrisma.licence.findFirst.mockResolvedValue({
      licenceid: LICENCE_ID,
      seatCount: 5,
    } as never);
    mockPrisma.licenceSeatAssignment.count.mockResolvedValue(1);
    mockPrisma.licenceSeatAssignment.findUniqueOrThrow.mockResolvedValue({
      id: "seat-1",
      seatNumber: 2,
      user: { firstname: "A", lastname: "B" },
    } as never);
  });

  it("reactivates the soft-deleted row instead of inserting a duplicate", async () => {
    mockPrisma.licenceSeatAssignment.findUnique.mockResolvedValue({
      id: "seat-1",
      seatNumber: 2,
      unassignedAt: new Date(),
    } as never);
    mockPrisma.licenceSeatAssignment.update.mockResolvedValue({
      id: "seat-1",
      seatNumber: 2,
    } as never);

    const res = await post();

    expect(res.status).toBe(201);
    expect(mockPrisma.licenceSeatAssignment.create).not.toHaveBeenCalled();
    expect(mockPrisma.licenceSeatAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "seat-1" },
        data: expect.objectContaining({ unassignedAt: null }),
      }),
    );
  });

  it("returns 409 when the user already holds an active seat", async () => {
    mockPrisma.licenceSeatAssignment.findUnique.mockResolvedValue({
      id: "seat-1",
      seatNumber: 2,
      unassignedAt: null,
    } as never);

    const res = await post();
    const { body } = await parseResponse<{ error: string }>(res);

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/already assigned/);
    expect(mockPrisma.licenceSeatAssignment.update).not.toHaveBeenCalled();
    expect(mockPrisma.licenceSeatAssignment.create).not.toHaveBeenCalled();
  });

  it("creates a new row with max(seatNumber) + 1 for a first-time user", async () => {
    mockPrisma.licenceSeatAssignment.findUnique.mockResolvedValue(null);
    mockPrisma.licenceSeatAssignment.aggregate.mockResolvedValue({
      _max: { seatNumber: 7 },
    } as never);
    mockPrisma.licenceSeatAssignment.create.mockResolvedValue({
      id: "seat-9",
      seatNumber: 8,
    } as never);

    const res = await post();

    expect(res.status).toBe(201);
    expect(mockPrisma.licenceSeatAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ seatNumber: 8, userId: USER_ID }),
      }),
    );
  });
});

describe("POST /api/kits/[id]/checkout licence items", () => {
  const post = () =>
    checkoutKit(
      createMockRequest(`/api/kits/${KIT_ID}/checkout`, {
        method: "POST",
        body: { userId: USER_ID },
      }) as never,
      { params: Promise.resolve({ id: KIT_ID }) },
    );

  const seat = (userId: string, seatNumber: number) => ({
    userId,
    seatNumber,
  });

  beforeEach(() => {
    mockPrisma.kit.findFirst.mockResolvedValue({
      id: KIT_ID,
      name: "Starter",
      isActive: true,
      items: [{ entityType: "licence", entityId: LICENCE_ID }],
    } as never);
    mockPrisma.user.findFirst.mockResolvedValue({
      userid: USER_ID,
      firstname: "A",
      lastname: "B",
    } as never);
  });

  it("takes max(seatNumber) + 1 rather than active count + 1", async () => {
    // Seats 1 and 3 are active, seat 2 was released: active + 1 would be 3.
    mockPrisma.licence.findFirst.mockResolvedValue({
      licenceid: LICENCE_ID,
      seatCount: 5,
      seatAssignments: [seat(uuid(10), 1), seat(uuid(11), 3)],
    } as never);
    mockPrisma.licenceSeatAssignment.findUnique.mockResolvedValue(null);
    mockPrisma.licenceSeatAssignment.aggregate.mockResolvedValue({
      _max: { seatNumber: 3 },
    } as never);
    mockPrisma.licenceSeatAssignment.create.mockResolvedValue({
      id: "seat-x",
      seatNumber: 4,
    } as never);

    const res = await post();
    const { body } = await parseResponse<{
      results: { status: string; detail?: string }[];
    }>(res);

    expect(res.status).toBe(201);
    expect(mockPrisma.licenceSeatAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ seatNumber: 4 }),
      }),
    );
    expect(body.results[0]).toMatchObject({
      status: "assigned",
      detail: "Seat 4",
    });
  });

  it("skips a user who already holds a seat instead of failing the checkout", async () => {
    mockPrisma.licence.findFirst.mockResolvedValue({
      licenceid: LICENCE_ID,
      seatCount: 5,
      seatAssignments: [seat(USER_ID, 1)],
    } as never);

    const res = await post();
    const { body } = await parseResponse<{ results: { status: string }[] }>(
      res,
    );

    expect(res.status).toBe(201);
    expect(body.results[0].status).toBe("already_assigned");
    expect(mockPrisma.licenceSeatAssignment.create).not.toHaveBeenCalled();
  });

  it("reactivates a previously released seat of the same user", async () => {
    mockPrisma.licence.findFirst.mockResolvedValue({
      licenceid: LICENCE_ID,
      seatCount: 5,
      seatAssignments: [],
    } as never);
    mockPrisma.licenceSeatAssignment.findUnique.mockResolvedValue({
      id: "seat-old",
      seatNumber: 2,
      unassignedAt: new Date(),
    } as never);
    mockPrisma.licenceSeatAssignment.update.mockResolvedValue({
      id: "seat-old",
      seatNumber: 2,
    } as never);

    const res = await post();

    expect(res.status).toBe(201);
    expect(mockPrisma.licenceSeatAssignment.create).not.toHaveBeenCalled();
    expect(mockPrisma.licenceSeatAssignment.update).toHaveBeenCalled();
  });
});
