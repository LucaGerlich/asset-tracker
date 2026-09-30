import { LIFECYCLE, type SampleStatus } from "../sample-data";

// Top row: Pending → Available → Active. Bottom row: Out for Repair, Retired.
const POS: Record<SampleStatus, { x: number; y: number }> = {
  Pending: { x: 4, y: 20 },
  Available: { x: 118, y: 20 },
  Active: { x: 232, y: 20 },
  "Out for Repair": { x: 118, y: 120 },
  Retired: { x: 232, y: 120 },
};
const W = 104;
const H = 26;
const MONO = "var(--font-geist-mono)";

function stroke(s: SampleStatus): string {
  if (s === "Active") return "var(--mkt-accent)";
  if (s === "Out for Repair") return "var(--mkt-warn)";
  return "var(--mkt-line)";
}

function fill(s: SampleStatus): string {
  return s === "Active" || s === "Out for Repair"
    ? stroke(s)
    : "var(--mkt-muted)";
}

export function LifecycleSchematic() {
  return (
    <svg viewBox="0 0 340 160" className="h-auto w-full" fill="none">
      <defs>
        <marker
          id="lc-arrow"
          viewBox="0 0 6 6"
          refX="3"
          refY="3"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0 0 L6 3 L0 6 z" fill="var(--mkt-warn)" />
        </marker>
      </defs>
      {/* forward flow */}
      <path
        d="M108 33 H118 M222 33 H232 M284 46 V120"
        stroke="var(--mkt-line)"
      />
      {/* Active → Out for Repair */}
      <path
        d="M270 46 V80 H190 V120"
        stroke="var(--mkt-warn)"
        strokeDasharray="3 3"
      />
      {/* Out for Repair → Available (repair done) */}
      <path
        d="M150 120 V50"
        stroke="var(--mkt-warn)"
        markerEnd="url(#lc-arrow)"
      />
      <text
        x="156"
        y="102"
        fontSize="9"
        fontFamily={MONO}
        fill="var(--mkt-warn)"
      >
        repair done
      </text>
      {LIFECYCLE.map((s) => {
        const p = POS[s];
        return (
          <g key={s}>
            <rect
              x={p.x}
              y={p.y}
              width={W}
              height={H}
              rx="3"
              fill="var(--mkt-surface)"
              stroke={stroke(s)}
            />
            <text
              x={p.x + W / 2}
              y={p.y + 17}
              textAnchor="middle"
              fontSize="9.5"
              fontFamily={MONO}
              fill={fill(s)}
            >
              {s.toUpperCase()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
