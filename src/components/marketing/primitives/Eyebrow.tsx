import type { ReactNode } from "react";

export function Eyebrow({
  index,
  children,
}: {
  index?: string;
  children: ReactNode;
}) {
  return (
    <p className="font-mkt-mono text-mkt-muted text-[11px] tracking-[0.18em] uppercase">
      [ {index && <span className="text-mkt-accent">{index} </span>}
      {children} ]
    </p>
  );
}
