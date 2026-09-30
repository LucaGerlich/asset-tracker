import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { LANDING_FAQ } from "@/lib/seo";
import { PLANS } from "@/lib/stripe";
import { DEPLOY, FEATURE_CELLS, HERO, TCO } from "../content";

// Marketing copy must stay true to the codebase (spec §1, principle 4).

const compose = readFileSync(join(process.cwd(), "docker-compose.yml"), "utf8");
const composeProfiles = new Set(
  [...compose.matchAll(/^\s+-\s+([\w-]+)\s*$/gm)].map((m) => m[1]),
);

function profileOf(command: string): string | null {
  return /--profile\s+([\w-]+)/.exec(command)?.[1] ?? null;
}

describe("marketing claims", () => {
  it("docker commands select a profile that exists in docker-compose.yml", () => {
    for (const command of [HERO.command, DEPLOY.selfHost.command]) {
      const profile = profileOf(command);
      expect(profile, command).not.toBeNull();
      expect(composeProfiles.has(profile ?? "")).toBe(true);
    }
  });

  it("the clone snippet runs compose inside the cloned repo", () => {
    expect(DEPLOY.selfHost.command).toMatch(
      /git clone \S+ && cd asset-tracker && docker compose/,
    );
  });

  it("landing FAQ states the real Starter limits", () => {
    const answer = LANDING_FAQ.map((f) => f.answer).join(" ");
    expect(answer).toContain(`up to ${PLANS.starter.maxAssets} assets`);
    expect(answer).toContain(`${PLANS.starter.maxUsers} users`);
  });

  it("does not claim maintenance costs are exported (export has depreciation only)", () => {
    expect(TCO.body).not.toMatch(/maintenance[^.]*export/i);
  });

  it("does not claim a licence renewal workflow (only expiry dates exist)", () => {
    expect(FEATURE_CELLS.licenses.description).not.toMatch(/renewal/i);
  });
});
