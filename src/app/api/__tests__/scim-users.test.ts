import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");

vi.mock("@/lib/scim", () => ({
  authenticateScim: vi.fn().mockResolvedValue(null),
  scimHeaders: vi
    .fn()
    .mockReturnValue({ "Content-Type": "application/scim+json" }),
  scimError: vi.fn((detail: string, status: number) => ({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
    detail,
    status,
  })),
  userToScim: vi.fn((user: any, baseUrl: string) => ({
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id: user.userid,
    userName: user.username || user.email,
    name: { givenName: user.firstname, familyName: user.lastname },
    emails: user.email
      ? [{ value: user.email, primary: true, type: "work" }]
      : [],
    active: user.isActive,
    meta: {
      resourceType: "User",
      created: user.creation_date?.toISOString(),
      lastModified: (user.change_date || user.creation_date)?.toISOString(),
      location: `${baseUrl}/api/scim/v2/Users/${user.userid}`,
    },
  })),
  scimListResponse: vi.fn(
    (resources: any[], total: number, startIndex: number) => ({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
      totalResults: total,
      itemsPerPage: resources.length,
      startIndex,
      Resources: resources,
    }),
  ),
}));

vi.mock("@/lib/logger");
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { CREATE: "create", UPDATE: "update", DELETE: "delete" },
  AUDIT_ENTITIES: { USER: "user" },
}));
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed-password") },
}));

import {
  GET as listUsers,
  POST as createUser,
} from "@/app/api/scim/v2/Users/route";
import {
  GET as getUser,
  PUT as replaceUser,
  PATCH as patchUser,
  DELETE as deleteUser,
} from "@/app/api/scim/v2/Users/[id]/route";
import prisma from "@/lib/prisma";
import { authenticateScim } from "@/lib/scim";

const mockPrisma = vi.mocked(prisma, true);
const mockAuth = vi.mocked(authenticateScim);

const mockUser = {
  userid: "user-001",
  username: "jdoe",
  firstname: "John",
  lastname: "Doe",
  email: "jdoe@example.com",
  isActive: true,
  externalId: "ext-001",
  creation_date: new Date("2024-01-01"),
  change_date: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ organizationId: "org-uuid-001" } as any);
});

// ---------------------------------------------------------------------------
// GET /api/scim/v2/Users  (list)
// ---------------------------------------------------------------------------
describe("GET /api/scim/v2/Users", () => {
  it("returns list of users in SCIM format", async () => {
    mockPrisma.user.findMany.mockResolvedValue([mockUser] as any);
    mockPrisma.user.count.mockResolvedValue(1);

    const req = createMockRequest("http://localhost:3000/api/scim/v2/Users");
    const res = await listUsers(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(200);
    expect(body.schemas).toContain(
      "urn:ietf:params:scim:api:messages:2.0:ListResponse",
    );
    expect(body.totalResults).toBe(1);
    expect(body.Resources).toHaveLength(1);
    expect(body.Resources[0].userName).toBe("jdoe");
  });

  it("filters by userName", async () => {
    mockPrisma.user.findMany.mockResolvedValue([mockUser] as any);
    mockPrisma.user.count.mockResolvedValue(1);

    const req = createMockRequest(
      'http://localhost:3000/api/scim/v2/Users?filter=userName eq "jdoe"',
    );
    const res = await listUsers(req);
    const { status } = await parseResponse<any>(res);

    expect(status).toBe(200);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ username: "jdoe" }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/scim/v2/Users  (create)
// ---------------------------------------------------------------------------
describe("POST /api/scim/v2/Users", () => {
  it("creates user and returns 201", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(mockUser as any);

    const req = createMockRequest("http://localhost:3000/api/scim/v2/Users", {
      method: "POST",
      body: {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
        userName: "jdoe",
        name: { givenName: "John", familyName: "Doe" },
        emails: [{ value: "jdoe@example.com", primary: true }],
        externalId: "ext-001",
        active: true,
      },
    });
    const res = await createUser(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(201);
    expect(body.userName).toBe("jdoe");
    expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
  });

  it("returns 409 when user already exists", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(mockUser as any);

    const req = createMockRequest("http://localhost:3000/api/scim/v2/Users", {
      method: "POST",
      body: {
        userName: "jdoe",
        name: { givenName: "John", familyName: "Doe" },
        emails: [{ value: "jdoe@example.com" }],
      },
    });
    const res = await createUser(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(409);
    expect(body.detail).toBe("User already exists");
  });

  it("returns 400 when userName is missing", async () => {
    const req = createMockRequest("http://localhost:3000/api/scim/v2/Users", {
      method: "POST",
      body: { name: { givenName: "John", familyName: "Doe" } },
    });
    const res = await createUser(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(400);
    expect(body.detail).toBe("userName is required");
  });
});

// ---------------------------------------------------------------------------
// GET /api/scim/v2/Users/:id
// ---------------------------------------------------------------------------
describe("GET /api/scim/v2/Users/:id", () => {
  it("returns a single user", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(mockUser as any);

    const req = createMockRequest(
      "http://localhost:3000/api/scim/v2/Users/user-001",
    );
    const res = await getUser(req, {
      params: Promise.resolve({ id: "user-001" }),
    });
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(200);
    expect(body.id).toBe("user-001");
    expect(body.userName).toBe("jdoe");
  });

  it("returns 404 when user not found", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const req = createMockRequest(
      "http://localhost:3000/api/scim/v2/Users/nonexistent",
    );
    const res = await getUser(req, {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(404);
    expect(body.detail).toBe("User not found");
  });
});

// ---------------------------------------------------------------------------
// PUT /api/scim/v2/Users/:id
// ---------------------------------------------------------------------------
describe("PUT /api/scim/v2/Users/:id", () => {
  it("replaces user data", async () => {
    const updatedUser = {
      ...mockUser,
      firstname: "Jane",
      lastname: "Smith",
    };
    mockPrisma.user.findFirst.mockResolvedValue(mockUser as any);
    mockPrisma.user.update.mockResolvedValue(updatedUser as any);

    const req = createMockRequest(
      "http://localhost:3000/api/scim/v2/Users/user-001",
      {
        method: "PUT",
        body: {
          userName: "jdoe",
          name: { givenName: "Jane", familyName: "Smith" },
          emails: [{ value: "jdoe@example.com" }],
          active: true,
        },
      },
    );
    const res = await replaceUser(req, {
      params: Promise.resolve({ id: "user-001" }),
    });
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(200);
    expect(body.name.givenName).toBe("Jane");
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userid: "user-001" } }),
    );
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/scim/v2/Users/:id
// ---------------------------------------------------------------------------
describe("PATCH /api/scim/v2/Users/:id", () => {
  it("applies Operations array for partial update", async () => {
    const patchedUser = { ...mockUser, isActive: false };
    mockPrisma.user.findFirst.mockResolvedValue(mockUser as any);
    mockPrisma.user.update.mockResolvedValue(patchedUser as any);

    const req = createMockRequest(
      "http://localhost:3000/api/scim/v2/Users/user-001",
      {
        method: "PATCH",
        body: {
          schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
          Operations: [{ op: "replace", path: "active", value: false }],
        },
      },
    );
    const res = await patchUser(req, {
      params: Promise.resolve({ id: "user-001" }),
    });
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(200);
    expect(body.active).toBe(false);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isActive: false }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/scim/v2/Users/:id
// ---------------------------------------------------------------------------
describe("DELETE /api/scim/v2/Users/:id", () => {
  it("soft-deletes user and returns 204", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(mockUser as any);
    mockPrisma.user.update.mockResolvedValue({
      ...mockUser,
      isActive: false,
    } as any);

    const req = createMockRequest(
      "http://localhost:3000/api/scim/v2/Users/user-001",
      { method: "DELETE" },
    );
    const res = await deleteUser(req, {
      params: Promise.resolve({ id: "user-001" }),
    });

    expect(res.status).toBe(204);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userid: "user-001" },
        data: expect.objectContaining({ isActive: false }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Auth failure
// ---------------------------------------------------------------------------
describe("SCIM auth failure", () => {
  it("returns 401 when authenticateScim rejects", async () => {
    const { NextResponse } = await import("next/server");
    const authResponse = NextResponse.json(
      {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        detail: "Unauthorized",
        status: 401,
      },
      { status: 401 },
    );
    mockAuth.mockResolvedValue(authResponse);

    const req = createMockRequest("http://localhost:3000/api/scim/v2/Users");
    const res = await listUsers(req);

    expect(res.status).toBe(401);
    const { body } = await parseResponse<any>(res);
    expect(body.detail).toBe("Unauthorized");
  });
});
