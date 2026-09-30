import Link from "next/link";
import { HERO, MARKETING_LINKS } from "../content";
import { SAMPLE_ASSETS } from "../sample-data";
import { BlockCursor } from "../primitives/BlockCursor";
import { CopyCommand } from "../primitives/CopyCommand";
import { Eyebrow } from "../primitives/Eyebrow";
import { ProductWindow } from "../primitives/ProductWindow";
import { StatusPill } from "../primitives/StatusPill";

const ROWS = SAMPLE_ASSETS.slice(0, 5);
const COLUMNS = ["Tag", "Name", "Status", "Assignee", "Location"] as const;

function AssetTable() {
  return (
    <div className="overflow-x-auto">
      <table className="font-mkt-mono w-full min-w-[560px] text-left text-[12px]">
        <caption className="sr-only">
          Sample assets of a fictional company
        </caption>
        <thead className="text-mkt-muted text-[10px] tracking-widest uppercase">
          <tr>
            {COLUMNS.map((h) => (
              <th key={h} scope="col" className="px-4 py-2.5 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((a, i) => (
            <tr
              key={a.tag}
              className={`border-mkt-line border-t ${i === 0 ? "bg-mkt-accent/5" : ""}`}
            >
              <td className="text-mkt-muted px-4 py-3">{a.tag}</td>
              <td className="px-4 py-3">{a.name}</td>
              <td className="px-4 py-3">
                <StatusPill status={a.status} />
              </td>
              <td className="text-mkt-muted px-4 py-3">{a.assignee ?? "—"}</td>
              <td className="text-mkt-muted px-4 py-3">{a.location}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Hero() {
  return (
    <section aria-label="Hero" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="mkt-grid pointer-events-none absolute inset-0"
      />
      <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28 lg:px-8">
        <Eyebrow>{HERO.eyebrow}</Eyebrow>
        <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
          {HERO.title}
          <BlockCursor />
        </h1>
        <p className="text-mkt-muted mx-auto mt-6 max-w-2xl text-base leading-relaxed sm:text-lg">
          {HERO.sub}
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={MARKETING_LINKS.register}
            className="bg-mkt-accent-fill text-mkt-accent-fill-fg rounded-md px-5 py-2.5 text-sm font-medium"
          >
            {HERO.primaryCta} →
          </Link>
          <CopyCommand command={HERO.command} />
        </div>
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <ProductWindow title="app / assets">
          <AssetTable />
        </ProductWindow>
      </div>
    </section>
  );
}
