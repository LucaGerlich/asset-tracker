import { SAMPLE_LICENSES } from "../sample-data";

const figma = SAMPLE_LICENSES[0];
const WINDOW_DAYS = 60;

export function LicenseSeatsSchematic() {
  const markerPct = (figma.daysToRenewal / WINDOW_DAYS) * 100;
  return (
    <div className="font-mkt-mono text-[11px]">
      <div className="text-mkt-muted flex justify-between">
        <span>seats</span>
        <span className="text-mkt-text">
          {figma.seatsUsed} / {figma.seatsTotal}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-10 gap-1">
        {Array.from({ length: figma.seatsTotal }, (_, i) => (
          <span
            key={i}
            className={`h-3 rounded-[2px] border ${
              i < figma.seatsUsed
                ? "bg-mkt-accent border-mkt-accent"
                : "border-mkt-node"
            }`}
          />
        ))}
      </div>
      <div className="relative mt-9 h-6">
        <div className="bg-mkt-node absolute inset-x-0 top-3 h-px" />
        <div
          className="bg-mkt-accent absolute top-3 left-0 h-px"
          style={{ width: `${markerPct}%` }}
        />
        <span
          className="border-mkt-accent bg-mkt-surface absolute top-1.5 h-3 w-3 -translate-x-1/2 rounded-full border"
          style={{ left: `${markerPct}%` }}
        />
        <span
          className="text-mkt-accent absolute -top-4 -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${markerPct}%` }}
        >
          renews {figma.renewsOn}
        </span>
      </div>
      <div className="text-mkt-muted flex justify-between">
        <span>today</span>
        <span>{figma.daysToRenewal}d</span>
        <span>+{WINDOW_DAYS}d</span>
      </div>
    </div>
  );
}
