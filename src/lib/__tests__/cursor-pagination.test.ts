import { describe, it, expect, vi } from "vitest";
import { cursorPaginate, parseCursorParams } from "@/lib/cursor-pagination";

function params(entries: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams(entries);
}

// ---------------------------------------------------------------------------
// parseCursorParams
// ---------------------------------------------------------------------------

describe("parseCursorParams", () => {
  it("returns null when no cursor-related params are present", () => {
    expect(parseCursorParams(params())).toBeNull();
    expect(parseCursorParams(params({ page: "2" }))).toBeNull();
  });

  it("detects cursor param", () => {
    const result = parseCursorParams(params({ cursor: "abc-123" }));
    expect(result).not.toBeNull();
    expect(result!.cursor).toBe("abc-123");
    expect(result!.direction).toBe("forward");
    expect(result!.limit).toBe(25);
  });

  it("detects limit param alone (first page with custom limit)", () => {
    const result = parseCursorParams(params({ limit: "10" }));
    expect(result).not.toBeNull();
    expect(result!.cursor).toBeNull();
    expect(result!.limit).toBe(10);
  });

  it("detects direction param alone", () => {
    const result = parseCursorParams(params({ direction: "backward" }));
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("backward");
  });

  it("clamps limit to 1–100", () => {
    expect(parseCursorParams(params({ limit: "0" }))!.limit).toBe(1);
    expect(parseCursorParams(params({ limit: "-5" }))!.limit).toBe(1);
    expect(parseCursorParams(params({ limit: "200" }))!.limit).toBe(100);
    expect(parseCursorParams(params({ limit: "abc" }))!.limit).toBe(25);
  });

  it("defaults direction to forward for unknown values", () => {
    expect(parseCursorParams(params({ direction: "bogus" }))!.direction).toBe(
      "forward",
    );
  });
});

// ---------------------------------------------------------------------------
// cursorPaginate
// ---------------------------------------------------------------------------

describe("cursorPaginate", () => {
  function makeMockDelegate(rows: Record<string, unknown>[]) {
    return {
      findMany: vi.fn().mockResolvedValue(rows),
    };
  }

  it("returns items and hasMore=false when fewer items than limit", async () => {
    const rows = [{ id: "a" }, { id: "b" }];
    const delegate = makeMockDelegate(rows);

    const result = await cursorPaginate(delegate, {
      cursorField: "id",
      limit: 10,
    });

    expect(result.items).toEqual(rows);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("returns hasMore=true and nextCursor when more items exist", async () => {
    // limit=2, so we fetch 3 rows; the 3rd is the sentinel
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const delegate = makeMockDelegate(rows);

    const result = await cursorPaginate(delegate, {
      cursorField: "id",
      limit: 2,
    });

    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("b");
  });

  it("passes cursor and skip:1 to findMany when cursor is provided", async () => {
    const delegate = makeMockDelegate([{ id: "d" }]);

    await cursorPaginate(delegate, {
      cursorField: "id",
      limit: 5,
      cursor: "c",
    });

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: "c" },
        skip: 1,
        take: 6, // limit + 1 sentinel
      }),
    );
  });

  it("does not pass cursor/skip when cursor is null", async () => {
    const delegate = makeMockDelegate([]);

    await cursorPaginate(delegate, {
      cursorField: "id",
      limit: 5,
    });

    const args = delegate.findMany.mock.calls[0][0];
    expect(args.cursor).toBeUndefined();
    expect(args.skip).toBeUndefined();
  });

  it("handles backward pagination — removes sentinel from front", async () => {
    // Backward: take is negative; sentinel is the first row
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const delegate = makeMockDelegate(rows);

    const result = await cursorPaginate(delegate, {
      cursorField: "id",
      limit: 2,
      cursor: "d",
      direction: "backward",
    });

    expect(result.items).toHaveLength(2);
    // sentinel "a" removed from front
    expect(result.items[0]).toEqual({ id: "b" });
    expect(result.hasMore).toBe(true);
  });

  it("uses negative take for backward direction", async () => {
    const delegate = makeMockDelegate([]);

    await cursorPaginate(delegate, {
      cursorField: "id",
      limit: 10,
      cursor: "x",
      direction: "backward",
    });

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: -11, // -(limit + 1)
      }),
    );
  });

  it("returns empty result for no rows", async () => {
    const delegate = makeMockDelegate([]);

    const result = await cursorPaginate(delegate, {
      cursorField: "id",
      limit: 10,
    });

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(result.previousCursor).toBeNull();
  });

  it("sets previousCursor when paginating forward with a cursor", async () => {
    const rows = [{ id: "d" }, { id: "e" }];
    const delegate = makeMockDelegate(rows);

    const result = await cursorPaginate(delegate, {
      cursorField: "id",
      limit: 5,
      cursor: "c",
      direction: "forward",
    });

    // previousCursor points to the first item in the result set
    expect(result.previousCursor).toBe("d");
  });

  it("does not set previousCursor on forward first page (no cursor)", async () => {
    const rows = [{ id: "a" }];
    const delegate = makeMockDelegate(rows);

    const result = await cursorPaginate(delegate, {
      cursorField: "id",
      limit: 5,
    });

    expect(result.previousCursor).toBeNull();
  });

  it("passes include option through to findMany", async () => {
    const delegate = makeMockDelegate([]);

    await cursorPaginate(delegate, {
      cursorField: "id",
      limit: 5,
      include: { category: true },
    });

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: { category: true } }),
    );
  });

  it("defaults limit to 25 when not provided", async () => {
    const delegate = makeMockDelegate([]);

    await cursorPaginate(delegate, { cursorField: "id" });

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 26 }),
    );
  });
});
