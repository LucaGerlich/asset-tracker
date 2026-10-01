import { SAMPLE_CONSUMABLES } from "../sample-data";

export function ConsumablesSchematic() {
  return (
    <ul className="font-mkt-mono flex flex-col gap-2.5 text-[11px]">
      {SAMPLE_CONSUMABLES.map((c, i) => {
        const tone = c.belowMinimum
          ? "border-mkt-warn text-mkt-warn"
          : i === 0
            ? "border-mkt-accent text-mkt-accent"
            : "border-mkt-node text-mkt-muted";
        const fill = c.belowMinimum ? "bg-mkt-warn" : "bg-mkt-accent";
        return (
          <li
            key={c.name}
            className={`bg-mkt-surface grid grid-cols-[minmax(0,1fr)_72px_52px] items-center gap-3 rounded border px-2.5 py-2 ${tone}`}
          >
            <span className="truncate">• {c.name}</span>
            <span className="border-mkt-node relative h-2.5 overflow-hidden rounded-[2px] border">
              <span
                className={`absolute inset-y-0 left-0 ${fill}`}
                style={{ width: `${c.stockPercent}%` }}
              />
            </span>
            <span className="text-right">
              {c.belowMinimum ? "reorder" : `${c.stockPercent}%`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
