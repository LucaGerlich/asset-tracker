import type { ReactNode } from "react";
import { FEATURES, FEATURE_CELLS } from "../content";
import { Eyebrow } from "../primitives/Eyebrow";
import { SchematicCell } from "../primitives/SchematicCell";
import { AuditLogSchematic } from "../schematics/AuditLog";
import { CheckoutSchematic } from "../schematics/Checkout";
import { ConsumablesSchematic } from "../schematics/Consumables";
import { IdentitySchematic } from "../schematics/Identity";
import { LicenseSeatsSchematic } from "../schematics/LicenseSeats";
import { LifecycleSchematic } from "../schematics/Lifecycle";

const CELLS: { key: keyof typeof FEATURE_CELLS; diagram: ReactNode }[] = [
  { key: "checkout", diagram: <CheckoutSchematic /> },
  { key: "licenses", diagram: <LicenseSeatsSchematic /> },
  { key: "lifecycle", diagram: <LifecycleSchematic /> },
  { key: "identity", diagram: <IdentitySchematic /> },
  { key: "consumables", diagram: <ConsumablesSchematic /> },
  { key: "audit", diagram: <AuditLogSchematic /> },
];

export function SchematicGrid() {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="mkt-reveal scroll-mt-20 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Eyebrow index="01">{FEATURES.eyebrow}</Eyebrow>
        <h2
          id="features-title"
          className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          {FEATURES.title}{" "}
          <span className="text-mkt-muted">{FEATURES.sub}</span>
        </h2>
        {/* gap-px over a line-colored background draws the hairlines between cells */}
        <div className="border-mkt-line bg-mkt-line mt-12 grid gap-px overflow-hidden rounded-xl border sm:grid-cols-2 lg:grid-cols-3">
          {CELLS.map((c) => (
            <div key={c.key} className="bg-mkt-surface flex">
              <SchematicCell copy={FEATURE_CELLS[c.key]}>
                {c.diagram}
              </SchematicCell>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
