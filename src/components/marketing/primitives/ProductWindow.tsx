import type { ReactNode } from "react";

// Always-dark "stage" (Antigravity-style) in both themes; mkt-stage-scope
// remaps the public tokens to the dark palette inside it.
export function ProductWindow({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mkt-stage-scope bg-mkt-stage text-mkt-text border-mkt-line overflow-hidden rounded-xl border shadow-[0_1px_2px_rgba(0,0,0,.06),0_12px_32px_rgba(0,0,0,.12)] ${className}`}
    >
      <div className="border-mkt-line flex items-center gap-2 border-b px-4 py-2.5">
        <span aria-hidden="true" className="flex gap-1.5">
          <span className="bg-mkt-line h-2.5 w-2.5 rounded-full" />
          <span className="bg-mkt-line h-2.5 w-2.5 rounded-full" />
          <span className="bg-mkt-line h-2.5 w-2.5 rounded-full" />
        </span>
        <span className="font-mkt-mono text-mkt-muted ml-2 text-[11px]">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}
