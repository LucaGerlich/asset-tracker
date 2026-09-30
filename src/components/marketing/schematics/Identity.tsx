const PROVIDERS = [
  "Entra ID",
  "Okta",
  "Google Workspace",
  "SAML 2.0",
  "OIDC",
] as const;
const MONO = "var(--font-geist-mono)";

export function IdentitySchematic() {
  return (
    <svg viewBox="0 0 340 170" className="h-auto w-full" fill="none">
      {PROVIDERS.map((p, i) => {
        const y = 8 + i * 32;
        const active = i === 0;
        const stroke = active ? "var(--mkt-accent)" : "var(--mkt-line)";
        return (
          <g key={p}>
            <path
              d={`M134 ${y + 12} H170 L220 85`}
              stroke={stroke}
              strokeWidth={active ? 1.5 : 1}
            />
            <rect
              x="4"
              y={y}
              width="130"
              height="24"
              rx="3"
              fill="var(--mkt-surface)"
              stroke={stroke}
            />
            <text
              x="16"
              y={y + 16}
              fontSize="10"
              fontFamily={MONO}
              fill={active ? "var(--mkt-accent)" : "var(--mkt-muted)"}
            >
              • {p}
            </text>
            <circle
              cx="170"
              cy={y + 12}
              r="3.5"
              fill="var(--mkt-surface)"
              stroke={stroke}
            />
          </g>
        );
      })}
      {/* isometric core */}
      <path
        d="M220 85 V120 L270 145 V110 M320 85 V120 L270 145"
        stroke="var(--mkt-line)"
      />
      <path
        d="M220 85 L270 60 L320 85 L270 110 Z"
        fill="var(--mkt-surface)"
        stroke="var(--mkt-accent)"
      />
      <text
        x="270"
        y="89"
        textAnchor="middle"
        fontSize="10"
        fontFamily={MONO}
        fill="var(--mkt-accent)"
      >
        ORG
      </text>
      <text
        x="270"
        y="163"
        textAnchor="middle"
        fontSize="9"
        fontFamily={MONO}
        fill="var(--mkt-muted)"
      >
        CORE
      </text>
    </svg>
  );
}
