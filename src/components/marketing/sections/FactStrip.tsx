import { FACTS } from "../content";

// 2×2 on mobile, 1×4 from md: borders follow the grid position.
const CELL_BORDERS = [
  "border-r border-b md:border-b-0",
  "border-b md:border-r md:border-b-0",
  "border-r md:border-r",
  "",
] as const;

export function FactStrip() {
  return (
    <section aria-label="Platform facts" className="border-mkt-line border-y">
      <ul className="font-mkt-mono mx-auto grid max-w-7xl grid-cols-2 text-[12px] md:grid-cols-4">
        {FACTS.map((f, i) => (
          <li
            key={f}
            className={`border-mkt-line text-mkt-muted flex items-center gap-2 px-4 py-5 sm:px-6 ${CELL_BORDERS[i]}`}
          >
            <span
              aria-hidden="true"
              className="bg-mkt-accent h-1.5 w-1.5 shrink-0"
            />
            {f}
          </li>
        ))}
      </ul>
    </section>
  );
}
