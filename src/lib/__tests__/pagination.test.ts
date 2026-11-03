import { describe, it, expect } from "vitest";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";

function params(entries: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams(entries);
}

describe("parsePaginationParams", () => {
  it("returns defaults when no params are provided", () => {
    const result = parsePaginationParams(params());
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
    expect(result.sortOrder).toBe("asc");
  });

  it("parses a valid page number", () => {
    expect(parsePaginationParams(params({ page: "3" })).page).toBe(3);
  });

  it("defaults page to 1 when value is 0", () => {
    expect(parsePaginationParams(params({ page: "0" })).page).toBe(1);
  });

  it("defaults page to 1 when value is negative", () => {
    expect(parsePaginationParams(params({ page: "-5" })).page).toBe(1);
  });

  it("defaults page to 1 when value is NaN", () => {
    expect(parsePaginationParams(params({ page: "abc" })).page).toBe(1);
  });

  it("parses valid pageSize", () => {
    expect(parsePaginationParams(params({ pageSize: "50" })).pageSize).toBe(50);
  });

  it("clamps pageSize to 1 when value is 0", () => {
    expect(
      parsePaginationParams(params({ pageSize: "0" })).pageSize,
    ).toBeGreaterThanOrEqual(1);
  });

  it("clamps pageSize to 100 when value exceeds maximum", () => {
    expect(
      parsePaginationParams(params({ pageSize: "999" })).pageSize,
    ).toBeLessThanOrEqual(100);
  });

  it("allows pageSize at boundaries", () => {
    expect(parsePaginationParams(params({ pageSize: "1" })).pageSize).toBe(1);
    expect(parsePaginationParams(params({ pageSize: "100" })).pageSize).toBe(
      100,
    );
  });

  it("parses sortBy, sortOrder, and search", () => {
    const result = parsePaginationParams(
      params({ sortBy: "name", sortOrder: "desc", search: "macbook" }),
    );
    expect(result.sortBy).toBe("name");
    expect(result.sortOrder).toBe("desc");
    expect(result.search).toBe("macbook");
  });

  it("defaults sortOrder to asc for unrecognized values", () => {
    expect(
      parsePaginationParams(params({ sortOrder: "random" })).sortOrder,
    ).toBe("asc");
  });
});

describe("buildPrismaArgs", () => {
  const allowedFields = ["name", "createdAt", "updatedAt"];

  it("calculates correct skip and take for page 1", () => {
    const result = buildPrismaArgs({ page: 1, pageSize: 25 }, allowedFields);
    expect(result.skip).toBe(0);
    expect(result.take).toBe(25);
  });

  it("calculates correct skip for page 3 with pageSize 10", () => {
    const result = buildPrismaArgs({ page: 3, pageSize: 10 }, allowedFields);
    expect(result.skip).toBe(20);
    expect(result.take).toBe(10);
  });

  it("includes orderBy when sortBy is in the allowed list", () => {
    const result = buildPrismaArgs(
      { page: 1, pageSize: 10, sortBy: "name", sortOrder: "asc" },
      allowedFields,
    );
    expect(result.orderBy).toEqual({ name: "asc" });
  });

  it("respects sortOrder desc", () => {
    const result = buildPrismaArgs(
      { page: 1, pageSize: 10, sortBy: "createdAt", sortOrder: "desc" },
      allowedFields,
    );
    expect(result.orderBy).toEqual({ createdAt: "desc" });
  });

  it("omits orderBy when sortBy is not in the allowed list", () => {
    const result = buildPrismaArgs(
      { page: 1, pageSize: 10, sortBy: "malicious_field", sortOrder: "asc" },
      allowedFields,
    );
    expect(result.orderBy).toBeUndefined();
  });

  it("omits orderBy when sortBy is undefined", () => {
    const result = buildPrismaArgs({ page: 1, pageSize: 10 }, allowedFields);
    expect(result.orderBy).toBeUndefined();
  });
});

describe("buildPaginatedResponse", () => {
  it("builds correct envelope", () => {
    const data = [{ id: 1 }, { id: 2 }];
    const result = buildPaginatedResponse(data, 50, {
      page: 1,
      pageSize: 25,
    });
    expect(result.total).toBe(50);
    expect(result.totalPages).toBe(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
    expect(result.data).toEqual(data);
  });

  it("adds truncated only when the search hit its cap", () => {
    const base = { page: 1, pageSize: 25 };
    expect(buildPaginatedResponse([], 0, base)).not.toHaveProperty("truncated");
    expect(
      buildPaginatedResponse([], 0, base, { truncated: false }),
    ).not.toHaveProperty("truncated");
    expect(
      buildPaginatedResponse([], 0, base, { truncated: true }).truncated,
    ).toBe(true);
  });

  it("handles zero total", () => {
    const result = buildPaginatedResponse([], 0, { page: 1, pageSize: 25 });
    expect(result.totalPages).toBe(0);
    expect(result.data).toEqual([]);
  });

  it("handles non-even division (rounds up)", () => {
    const result = buildPaginatedResponse([{ id: 1 }], 26, {
      page: 1,
      pageSize: 25,
    });
    expect(result.totalPages).toBe(2);
  });

  it("calculates totalPages as 1 when total equals pageSize", () => {
    const result = buildPaginatedResponse([{ id: 1 }], 10, {
      page: 1,
      pageSize: 10,
    });
    expect(result.totalPages).toBe(1);
  });

  it("handles pageSize of 1", () => {
    const result = buildPaginatedResponse([{ id: 1 }], 7, {
      page: 4,
      pageSize: 1,
    });
    expect(result.totalPages).toBe(7);
  });
});
