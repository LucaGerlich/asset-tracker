import { describe, it, expect } from "vitest";
import {
  SAMPLE_ASSETS,
  SAMPLE_PEOPLE,
  SAMPLE_LOCATIONS,
  SAMPLE_LICENSES,
  SAMPLE_CONSUMABLES,
  SAMPLE_AUDIT_EVENTS,
  LIFECYCLE,
} from "../sample-data";
import { RACK_LINES } from "../ascii/rack-art";

const REAL_STATUSES = [
  "Active",
  "Available",
  "Pending",
  "Out for Repair",
  "Retired",
];

describe("marketing sample data", () => {
  it("has unique asset tags", () => {
    const tags = SAMPLE_ASSETS.map((a) => a.tag);
    expect(new Set(tags).size).toBe(tags.length);
  });

  it("only assigns assets to existing people and locations", () => {
    const handles = new Set(SAMPLE_PEOPLE.map((p) => p.handle));
    const locations = new Set(SAMPLE_LOCATIONS.map((l) => l.id));
    for (const asset of SAMPLE_ASSETS) {
      if (asset.assignee !== null)
        expect(handles.has(asset.assignee)).toBe(true);
      expect(locations.has(asset.location)).toBe(true);
    }
  });

  it("uses the app's real status names", () => {
    for (const asset of SAMPLE_ASSETS)
      expect(REAL_STATUSES).toContain(asset.status);
    for (const step of LIFECYCLE) expect(REAL_STATUSES).toContain(step);
  });

  it("only Active or Out for Repair assets have an assignee", () => {
    for (const asset of SAMPLE_ASSETS) {
      expect(asset.assignee !== null).toBe(
        asset.status === "Active" || asset.status === "Out for Repair",
      );
    }
  });

  it("keeps license seats and stock levels in range", () => {
    for (const l of SAMPLE_LICENSES) {
      expect(l.seatsUsed).toBeGreaterThanOrEqual(0);
      expect(l.seatsUsed).toBeLessThanOrEqual(l.seatsTotal);
    }
    for (const c of SAMPLE_CONSUMABLES) {
      expect(c.stockPercent).toBeGreaterThanOrEqual(0);
      expect(c.stockPercent).toBeLessThanOrEqual(100);
      expect(c.belowMinimum).toBe(c.stockPercent < c.minimumPercent);
    }
  });

  it("references known asset tags and people in audit events", () => {
    const tags = new Set(SAMPLE_ASSETS.map((a) => a.tag));
    const handles = new Set(SAMPLE_PEOPLE.map((p) => p.handle));
    for (const e of SAMPLE_AUDIT_EVENTS) {
      if (e.assetTag) expect(tags.has(e.assetTag)).toBe(true);
      if (e.person) expect(handles.has(e.person)).toBe(true);
    }
  });
});

describe("rack art", () => {
  const strip = (l: string) => l.replace(/\[\[|\]\]|\{\{|\}\}/g, "");

  it("has equal-length lines once markers are stripped", () => {
    const widths = new Set(RACK_LINES.map((l) => strip(l).length));
    expect(widths.size).toBe(1);
  });

  it("is pure printable ASCII", () => {
    for (const l of RACK_LINES) expect(/^[\x20-\x7e]*$/.test(l)).toBe(true);
  });

  it("agrees with the sample data for tags it shares", () => {
    const art = RACK_LINES.map(strip);
    for (const asset of SAMPLE_ASSETS) {
      // Crate labels sit under the tag; the readout also mentions AT-00421,
      // so match the tag only where it is followed by crate padding.
      const row = art.findIndex((l) => l.includes(`| ${asset.tag}    |`));
      if (row === -1) continue;
      const col = art[row].indexOf(`| ${asset.tag}`) + 2;
      const label = art[row + 1].slice(col, col + 11).trim();
      const expected =
        asset.status === "Out for Repair"
          ? "REPAIR"
          : asset.status.toUpperCase();
      expect(label, asset.tag).toBe(expected);
    }
  });
});
