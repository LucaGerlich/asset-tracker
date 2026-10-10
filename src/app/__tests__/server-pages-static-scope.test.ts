import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Static guard for the server-rendered pages hardened in Task 13c. These pages
 * pass Prisma results straight into client components, so an unfiltered
 * `prisma.<model>.findMany()` ships every tenant's rows to the browser.
 *
 * The loaders with real branching (reports, tickets, settings, ...) have
 * behavioural tests in server-pages-org-scope.test.ts; this test is the cheap
 * net for the rest and for future edits to the same files.
 */

const APP_DIR = path.resolve(__dirname, "..");

/** Files that must not contain a findMany() without a `where`. */
const GUARDED_FILES = [
  "reports/page.tsx",
  "reports/data.ts",
  "admin/tickets/page.tsx",
  "admin/tickets/data.ts",
  "admin/settings/page.tsx",
  "admin/settings/data.ts",
  "consumables/[id]/page.tsx",
  "components/[id]/page.tsx",
  "components/[id]/edit/page.tsx",
  "components/create/page.tsx",
  "user/[id]/edit/page.tsx",
  "user/[id]/edit/data.ts",
  "user/[id]/settings/page.tsx",
  "user/[id]/settings/data.ts",
  "reservations/page.tsx",
  "reservations/data.ts",
];

/**
 * Platform-wide tables with no organizationId column: an unfiltered read is
 * intended. Keyed by file, so a new unfiltered read elsewhere still fails.
 */
const PLATFORM_WIDE_READS: Record<string, string[]> = {
  "admin/settings/page.tsx": ["email_templates", "label_templates"],
};

interface FindManyCall {
  model: string;
  args: string;
}

/** Every `prisma.<model>.findMany(<args>)` call with its balanced argument text. */
function findManyCalls(source: string): FindManyCall[] {
  const calls: FindManyCall[] = [];
  const start = /prisma\.(\w+)\.findMany\(/g;
  let match: RegExpExecArray | null;
  while ((match = start.exec(source)) !== null) {
    let depth = 1;
    let i = start.lastIndex;
    while (i < source.length && depth > 0) {
      if (source[i] === "(") depth++;
      else if (source[i] === ")") depth--;
      i++;
    }
    calls.push({ model: match[1], args: source.slice(start.lastIndex, i - 1) });
  }
  return calls;
}

describe("findManyCalls helper", () => {
  it("finds calls with nested parentheses and reads their arguments", () => {
    const source = `
      prisma.user.findMany();
      prisma.asset.findMany({ where: { name: fn(1) }, include: { a: true } });
    `;
    expect(findManyCalls(source)).toEqual([
      { model: "user", args: "" },
      {
        model: "asset",
        args: "{ where: { name: fn(1) }, include: { a: true } }",
      },
    ]);
  });
});

describe("server-rendered pages never run an unfiltered findMany", () => {
  for (const file of GUARDED_FILES) {
    it(file, () => {
      const source = readFileSync(path.join(APP_DIR, file), "utf8");
      const allowed = PLATFORM_WIDE_READS[file] ?? [];

      const unfiltered = findManyCalls(source)
        .filter((call) => !/\bwhere\b/.test(call.args))
        .map((call) => call.model)
        .filter((model) => !allowed.includes(model));

      expect(unfiltered).toEqual([]);
    });
  }
});

describe("pickers use the organization-scoped data helpers", () => {
  const read = (file: string) => readFileSync(path.join(APP_DIR, file), "utf8");

  it("consumable detail loads its user picker via getUserOptions", () => {
    expect(read("consumables/[id]/page.tsx")).toContain("getUserOptions()");
  });

  it("component detail loads its asset picker via getAssetOptions", () => {
    expect(read("components/[id]/page.tsx")).toContain("getAssetOptions()");
  });

  it("component create and edit load locations via getLocationOptions", () => {
    expect(read("components/create/page.tsx")).toContain(
      "getLocationOptions()",
    );
    expect(read("components/[id]/edit/page.tsx")).toContain(
      "getLocationOptions()",
    );
  });
});
