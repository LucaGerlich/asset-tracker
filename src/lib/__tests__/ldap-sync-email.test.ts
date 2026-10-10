import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import type { Prisma } from "@prisma/client";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/encryption", () => ({ decrypt: vi.fn((v: string) => v) }));
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed-password") },
}));

interface DirectoryEntry {
  dn: string;
  attrs: Record<string, string>;
}

const directory = vi.hoisted(() => ({ entries: [] as DirectoryEntry[] }));

vi.mock("ldapjs", () => ({
  default: {
    createClient: () => ({
      bind: (_dn: string, _pw: string, cb: (err: Error | null) => void) =>
        cb(null),
      unbind: (cb: () => void) => cb(),
      search: (
        _base: string,
        _opts: unknown,
        cb: (err: Error | null, res: EventEmitter) => void,
      ) => {
        const res = new EventEmitter();
        cb(null, res);
        queueMicrotask(() => {
          for (const entry of directory.entries) {
            res.emit("searchEntry", {
              dn: { toString: () => entry.dn },
              attributes: Object.entries(entry.attrs).map(([type, value]) => ({
                type,
                values: [value],
              })),
            });
          }
          res.emit("end");
        });
      },
    }),
  },
}));

import { syncUsers } from "@/lib/ldap";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

const mockPrisma = vi.mocked(prisma, true);

const RESERVED = "root@example.com";

function entry(
  username: string,
  email: string | undefined,
  guid: string,
): DirectoryEntry {
  return {
    dn: `CN=${username},DC=example`,
    attrs: {
      sAMAccountName: username,
      ...(email ? { mail: email } : {}),
      givenName: "Given",
      sn: "Family",
      objectGUID: guid,
    },
  };
}

/**
 * `existing` answers the user-by-externalId/username lookup; `held` makes the
 * exact-match email lookups report that another user already holds the address.
 */
function stubLookups(opts: {
  existing?: Record<string, unknown> | null;
  held?: boolean;
}) {
  mockPrisma.user.findFirst.mockReset();
  mockPrisma.user.findFirst.mockResolvedValue((opts.existing ?? null) as never);
  mockPrisma.$queryRaw.mockReset();
  mockPrisma.$queryRaw.mockResolvedValue([{ count: opts.held ? 1 : 0 }]);
}

/** The n-th parameterized statement sent through prisma.$queryRaw. */
function sentQuery(index: number): Prisma.Sql {
  return mockPrisma.$queryRaw.mock.calls[index][0] as unknown as Prisma.Sql;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("SUPER_ADMIN_EMAILS", RESERVED);
  directory.entries = [];
  mockPrisma.system_settings.findMany.mockResolvedValue(
    [
      ["ldap.enabled", "true"],
      ["ldap.serverUrl", "ldap://ldap.example.test:389"],
      ["ldap.searchBase", "DC=example"],
      ["ldap.bindDN", "CN=svc,DC=example"],
      ["ldap.bindPassword", "secret"],
    ].map(([settingKey, settingValue]) => ({
      settingKey,
      settingValue,
      isEncrypted: false,
    })) as never,
  );
  mockPrisma.user.create.mockResolvedValue({ userid: "created" } as never);
  mockPrisma.user.update.mockResolvedValue({ userid: "updated" } as never);
  stubLookups({});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("syncUsers email ownership", () => {
  it("skips an entry with a reserved address and keeps syncing the rest", async () => {
    directory.entries = [
      entry("mallory", "Root@Example.com", "guid-1"),
      entry("alice", "alice@example.com", "guid-2"),
    ];

    const result = await syncUsers("org-1");

    expect(result.success).toBe(true);
    expect(result.created).toBe(1);
    expect(result.errors).toEqual([
      "Entry CN=mallory,DC=example: Forbidden: This email address is reserved",
    ]);
    expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          username: "alice",
          email: "alice@example.com",
        }),
      }),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "LDAP sync skipped user: email not assignable",
      expect.objectContaining({ dn: "CN=mallory,DC=example" }),
    );
  });

  it("skips an entry whose email another user already holds", async () => {
    directory.entries = [entry("bob", "Taken@Example.com", "guid-3")];
    stubLookups({ held: true });

    const result = await syncUsers("org-1");

    expect(result.success).toBe(true);
    expect(result.created).toBe(0);
    expect(result.errors).toEqual([
      "Entry CN=bob,DC=example: Email is already in use",
    ]);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("does not update an existing user whose new email is not assignable", async () => {
    directory.entries = [entry("carol", "Taken@Example.com", "guid-4")];
    stubLookups({
      existing: { userid: "carol-id", email: "carol@example.com" },
      held: true,
    });

    const result = await syncUsers("org-1");

    expect(result.updated).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("updates an existing user with the normalised email, excluding that user from the conflict lookup", async () => {
    directory.entries = [entry("carol", "Carol.New@Example.com", "guid-5")];
    stubLookups({
      existing: { userid: "carol-id", email: "carol@example.com" },
    });

    const result = await syncUsers("org-1");

    expect(result.updated).toBe(1);
    expect(result.errors).toEqual([]);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(sentQuery(0).text).toContain(`"userid" <> $2::uuid`);
    expect(sentQuery(0).values).toEqual(["carol.new@example.com", "carol-id"]);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userid: "carol-id" },
        data: expect.objectContaining({ email: "carol.new@example.com" }),
      }),
    );
  });

  it("keeps the current email when the directory entry has none", async () => {
    directory.entries = [entry("dave", undefined, "guid-6")];
    stubLookups({
      existing: { userid: "dave-id", email: "dave@example.com" },
    });

    await syncUsers("org-1");

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "dave@example.com" }),
      }),
    );
    // Only the user lookup ran; no email ownership lookup.
    expect(mockPrisma.user.findFirst).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("keeps a reserved address on the existing account that already holds it", async () => {
    directory.entries = [entry("root", "Root@Example.com", "guid-8")];
    stubLookups({ existing: { userid: "root-id", email: RESERVED } });
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: 1 }]); // holder check
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: 0 }]); // no other holder

    const result = await syncUsers("org-1");

    expect(result.errors).toEqual([]);
    expect(result.updated).toBe(1);
    expect(sentQuery(0).values).toEqual(["root-id", RESERVED]);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userid: "root-id" },
        data: expect.objectContaining({ email: RESERVED }),
      }),
    );
  });

  it("creates a user without an email and skips the ownership lookup", async () => {
    directory.entries = [entry("erin", undefined, "guid-7")];

    const result = await syncUsers("org-1");

    expect(result.created).toBe(1);
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ username: "erin", email: null }),
      }),
    );
    expect(mockPrisma.user.findFirst).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });
});
