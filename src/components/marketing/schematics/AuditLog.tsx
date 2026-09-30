import { SAMPLE_AUDIT_EVENTS } from "../sample-data";

const TONE = {
  default: "text-mkt-muted",
  accent: "text-mkt-accent",
  warn: "text-mkt-warn",
  muted: "text-mkt-muted",
} as const;

export function AuditLogSchematic() {
  return (
    <ol className="font-mkt-mono flex flex-col gap-1.5 text-[11px] leading-snug">
      {SAMPLE_AUDIT_EVENTS.map((e, i) => (
        <li key={e.time} className={`truncate ${TONE[e.tone]}`}>
          <span className="opacity-70">{e.time}</span>{" "}
          <span className="text-mkt-text">{e.action}</span> {e.text}
          {i === SAMPLE_AUDIT_EVENTS.length - 1 && (
            <span className="bg-mkt-accent ml-1 inline-block h-3 w-1.5 align-middle" />
          )}
        </li>
      ))}
    </ol>
  );
}
