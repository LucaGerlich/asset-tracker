import type { SampleStatus } from "../sample-data";

const TONE: Record<SampleStatus, string> = {
  Active: "border-mkt-accent text-mkt-accent",
  "Out for Repair": "border-mkt-warn text-mkt-warn",
  Available: "border-mkt-line text-mkt-text",
  Pending: "border-mkt-line text-mkt-muted",
  Retired: "border-mkt-line text-mkt-muted line-through",
};

export function StatusPill({ status }: { status: SampleStatus }) {
  return (
    <span
      className={`font-mkt-mono inline-block rounded-sm border px-1.5 py-0.5 text-[10px] tracking-wider whitespace-nowrap uppercase ${TONE[status]}`}
    >
      {status}
    </span>
  );
}
