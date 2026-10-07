import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * triggerWebhook(event, data, organizationId): without an organization the
 * event reaches only global webhooks, so every caller must say which
 * organization the event belongs to (or pass null for a platform-level event).
 * This scan fails when a call site is missing the third argument.
 */

const SRC_DIR = path.resolve(__dirname, "../..");
const WEBHOOKS_MODULE = path.join(SRC_DIR, "lib", "webhooks.ts");
const REQUIRED_ARGUMENTS = 3;

type TriggerCall = { line: number; argumentCount: number };

function isComment(source: string, index: number): boolean {
  return (
    source[index] === "/" &&
    (source[index + 1] === "/" || source[index + 1] === "*")
  );
}

/**
 * Returns the index just past the comment or string literal starting at
 * `index`, or `index` itself when none starts there. Quoted strings end at a
 * line break so a stray apostrophe in JSX text cannot swallow the file.
 */
function skipTrivia(source: string, index: number): number {
  const char = source[index];
  if (isComment(source, index)) {
    if (source[index + 1] === "/") {
      const end = source.indexOf("\n", index);
      return end === -1 ? source.length : end;
    }
    const end = source.indexOf("*/", index + 2);
    return end === -1 ? source.length : end + 2;
  }
  if (char === '"' || char === "'") {
    let cursor = index + 1;
    while (
      cursor < source.length &&
      source[cursor] !== char &&
      source[cursor] !== "\n"
    ) {
      cursor += source[cursor] === "\\" ? 2 : 1;
    }
    return cursor + 1;
  }
  if (char === "`") {
    let cursor = index + 1;
    while (cursor < source.length && source[cursor] !== "`") {
      if (source[cursor] === "\\") {
        cursor += 2;
      } else if (source[cursor] === "$" && source[cursor + 1] === "{") {
        cursor = skipBraces(source, cursor + 1);
      } else {
        cursor += 1;
      }
    }
    return cursor + 1;
  }
  return index;
}

/** Index just past the `}` that closes the `{` at `open`. */
function skipBraces(source: string, open: number): number {
  let depth = 0;
  let cursor = open;
  while (cursor < source.length) {
    const skipped = skipTrivia(source, cursor);
    if (skipped !== cursor) {
      cursor = skipped;
      continue;
    }
    if (source[cursor] === "{") depth += 1;
    if (source[cursor] === "}") {
      depth -= 1;
      if (depth === 0) return cursor + 1;
    }
    cursor += 1;
  }
  return cursor;
}

/**
 * Counts the top-level arguments of the call whose `(` is at `open`. Commas
 * nested in (), [], {}, strings, template literals or comments do not count,
 * and a trailing comma does not add an empty argument.
 */
function countArguments(source: string, open: number): number {
  let depth = 0;
  let count = 0;
  let hasContent = false;
  let cursor = open + 1;
  while (cursor < source.length) {
    const skipped = skipTrivia(source, cursor);
    if (skipped !== cursor) {
      if (!isComment(source, cursor)) hasContent = true;
      cursor = skipped;
      continue;
    }
    const char = source[cursor];
    if (depth === 0 && char === ")") {
      return hasContent ? count + 1 : count;
    }
    if (depth === 0 && char === ",") {
      if (hasContent) count += 1;
      hasContent = false;
    } else if (!/\s/.test(char)) {
      hasContent = true;
      if (char === "(" || char === "[" || char === "{") depth += 1;
      if (char === ")" || char === "]" || char === "}") depth -= 1;
    }
    cursor += 1;
  }
  return count;
}

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

/** Finds every triggerWebhook( call, ignoring comments and string contents. */
function findTriggerCalls(source: string): TriggerCall[] {
  const calls: TriggerCall[] = [];
  const name = "triggerWebhook";
  let cursor = 0;
  while (cursor < source.length) {
    const skipped = skipTrivia(source, cursor);
    if (skipped !== cursor) {
      cursor = skipped;
      continue;
    }
    if (
      source.startsWith(name, cursor) &&
      !/\w/.test(source[cursor - 1] ?? "")
    ) {
      const afterName = cursor + name.length;
      const open = source.slice(afterName).search(/\S/) + afterName;
      if (source[open] === "(") {
        calls.push({
          line: lineAt(source, cursor),
          argumentCount: countArguments(source, open),
        });
      }
      cursor = afterName;
      continue;
    }
    cursor += 1;
  }
  return calls;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (entry === "__tests__") return [];
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) && full !== WEBHOOKS_MODULE ? [full] : [];
  });
}

describe("triggerWebhook call scanner", () => {
  const counts = (source: string) =>
    findTriggerCalls(source).map((call) => call.argumentCount);

  it("does not count commas inside object literals, arrays or calls", () => {
    expect(
      counts(`triggerWebhook("a", { x: 1, y: [1, 2], z: f(1, 2) });`),
    ).toEqual([2]);
  });

  it("counts a third argument, with or without a trailing comma", () => {
    expect(
      counts(`triggerWebhook("a", { x: 1 }, user.organizationId);`),
    ).toEqual([3]);
    expect(counts(`triggerWebhook(\n  "a",\n  { x: 1 },\n  org,\n);`)).toEqual([
      3,
    ]);
    expect(counts(`triggerWebhook("a", { x: 1 }, null);`)).toEqual([3]);
  });

  it("ignores commas and parentheses inside strings and templates", () => {
    expect(
      counts("triggerWebhook(\"a,b)\", { m: `x, ${f(1, 2)} )`, n: 'y,)' });"),
    ).toEqual([2]);
  });

  it("ignores comments inside and around calls", () => {
    expect(
      counts(
        `// triggerWebhook("a");\ntriggerWebhook("a", /* x, y */ { z: 1 } // , org\n);`,
      ),
    ).toEqual([2]);
  });

  it("reports the line of each call", () => {
    const calls = findTriggerCalls(`\n\ntriggerWebhook("a", {});`);
    expect(calls).toEqual([{ line: 3, argumentCount: 2 }]);
  });

  it("does not match longer identifiers or non-calls", () => {
    expect(
      findTriggerCalls(
        `import { triggerWebhook } from "x";\nconst fn = myTriggerWebhook(1);`,
      ),
    ).toEqual([]);
  });
});

describe("triggerWebhook callers", () => {
  const callers = sourceFiles(SRC_DIR).map((file) => ({
    relative: path.relative(path.resolve(SRC_DIR, ".."), file),
    calls: findTriggerCalls(readFileSync(file, "utf8")),
  }));

  it("finds the call sites it is meant to check", () => {
    const total = callers.reduce((sum, file) => sum + file.calls.length, 0);
    expect(total).toBeGreaterThan(0);
  });

  it("passes the organization to every call", () => {
    const offenders = callers.flatMap((file) =>
      file.calls
        .filter((call) => call.argumentCount < REQUIRED_ARGUMENTS)
        .map((call) => `${file.relative}:${call.line}`),
    );
    expect(offenders).toEqual([]);
  });
});
