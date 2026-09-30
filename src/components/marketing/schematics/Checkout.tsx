import { SAMPLE_ASSETS } from "../sample-data";

const asset = SAMPLE_ASSETS[0]; // AT-00412 → m.keller
const TARGETS = [
  { label: asset.assignee ?? "", active: true },
  { label: asset.location, active: false },
  { label: "due 2026-10-14", active: false },
];

function Pill({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`font-mkt-mono bg-mkt-surface block truncate rounded border px-2.5 py-1.5 text-[11px] ${
        active
          ? "border-mkt-accent text-mkt-accent"
          : "border-mkt-line text-mkt-muted"
      }`}
    >
      • {label}
    </span>
  );
}

export function CheckoutSchematic() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)] items-center">
      <Pill label={asset.name} active={false} />
      <svg viewBox="0 0 48 120" className="h-[120px] w-12" fill="none">
        <path d="M24 60 V100 H48 M24 60 H48" stroke="var(--mkt-line)" />
        <path
          d="M0 60 H24 V20 H48"
          stroke="var(--mkt-accent)"
          strokeWidth="1.5"
        />
        <circle
          cx="24"
          cy="60"
          r="4"
          fill="var(--mkt-surface)"
          stroke="var(--mkt-accent)"
          strokeWidth="1.5"
        />
      </svg>
      <div className="flex flex-col gap-4">
        {TARGETS.map((t) => (
          <Pill key={t.label} {...t} />
        ))}
      </div>
    </div>
  );
}
