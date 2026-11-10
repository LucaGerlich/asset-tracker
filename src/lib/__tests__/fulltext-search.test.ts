import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma");

import prisma from "@/lib/prisma";
import { FULLTEXT_RESULT_LIMIT, searchIdsByFullText } from "../fulltext-search";

const mockPrisma = vi.mocked(prisma, true);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("searchIdsByFullText", () => {
  it("filters by organization, limits the result and parameterises input", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([{ assetid: "a-1" }]);

    const ids = await searchIdsByFullText("asset", "org-1", "red laptop");

    expect(ids).toEqual(["a-1"]);
    const [sql, ...params] = mockPrisma.$queryRawUnsafe.mock.calls[0] as [
      string,
      ...unknown[],
    ];
    expect(sql).toContain('FROM "asset"');
    expect(sql).toContain("websearch_to_tsquery('english', $1)");
    expect(sql).toContain('"organizationId" = $2');
    expect(sql).toContain(`LIMIT ${FULLTEXT_RESULT_LIMIT}`);
    expect(FULLTEXT_RESULT_LIMIT).toBe(1000);
    // The user's text never reaches the SQL string.
    expect(sql).not.toContain("laptop");
    expect(params).toEqual(["red & laptop", "org-1"]);
  });

  it("matches org-less records only for an org-less caller", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

    await searchIdsByFullText("licence", null, "key");

    const [sql, ...params] = mockPrisma.$queryRawUnsafe.mock.calls[0] as [
      string,
      ...unknown[],
    ];
    expect(sql).toContain('"organizationId" IS NULL');
    expect(sql).not.toContain("$2");
    expect(params).toEqual(["key"]);
  });

  it("maps each table to its id column", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([{ id: "c-1" }]);
    expect(await searchIdsByFullText("components", "org-1", "ram")).toEqual([
      "c-1",
    ]);
    const [sql] = mockPrisma.$queryRawUnsafe.mock.calls[0] as [string];
    expect(sql).toContain('SELECT "id" FROM "components"');
  });

  it("returns null when the query fails so callers can fall back", async () => {
    mockPrisma.$queryRawUnsafe.mockRejectedValue(new Error("no such column"));
    expect(await searchIdsByFullText("user", "org-1", "bob")).toBeNull();
  });
});
