import type { ReactNode } from "react";
import { RACK_LINES } from "./rack-art";

const TOKEN = /(\[\[.*?\]\]|\{\{.*?\}\})/g;

function renderLine(line: string): ReactNode[] {
  return line.split(TOKEN).map((part, i) => {
    if (part.startsWith("[["))
      return (
        <span key={i} className="text-mkt-accent">
          {part.slice(2, -2)}
        </span>
      );
    if (part.startsWith("{{"))
      return (
        <span key={i} className="text-mkt-warn">
          {part.slice(2, -2)}
        </span>
      );
    return part;
  });
}

// Decorative: clipped (never scrolls) on narrow screens.
export function RackIllustration() {
  return (
    <div className="min-w-0 overflow-hidden">
      <pre
        aria-hidden="true"
        className="font-mkt-mono text-mkt-muted text-[9px] leading-[1.15] sm:text-[11px] xl:text-xs"
      >
        {RACK_LINES.map((line, i) => (
          <span key={i} className="block">
            {renderLine(line)}
          </span>
        ))}
      </pre>
    </div>
  );
}
