import type { ReactNode } from "react";
import type { FeatureCellCopy } from "../content";

export function SchematicCell({
  copy,
  children,
}: {
  copy: FeatureCellCopy;
  children: ReactNode;
}) {
  return (
    <article className="flex min-w-0 flex-col">
      <div className="mkt-dots border-mkt-line relative h-60 overflow-hidden border-b px-5 pt-4">
        <div className="font-mkt-mono text-mkt-muted flex justify-between text-[11px]">
          <span>{copy.label}</span>
          <span>{copy.meta}</span>
        </div>
        <div
          aria-hidden="true"
          className="border-mkt-muted/60 mt-1.5 h-1.5 border-x border-b"
        />
        <div aria-hidden="true" className="mt-4">
          {children}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-semibold">{copy.title}</h3>
        <p className="text-mkt-muted mt-2 text-sm leading-relaxed">
          {copy.description}
        </p>
        <p className="font-mkt-mono text-mkt-muted mt-auto pt-4 text-[11px]">
          {copy.footer}
        </p>
      </div>
    </article>
  );
}
