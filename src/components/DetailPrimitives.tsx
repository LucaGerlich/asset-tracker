import type { LucideIcon } from "lucide-react";

/** Compact metric tile for an entity hero stat strip. */
export function StatTile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-default-200 bg-default-50/40 flex flex-col gap-1 rounded-lg border px-3 py-2">
      <span className="text-foreground-500 text-[11px] font-medium tracking-wide uppercase">
        {label}
      </span>
      <span className="text-sm font-semibold">{children}</span>
    </div>
  );
}

/** A bordered detail card with a heading. */
export function DetailCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`border-default-200 rounded-lg border p-4 ${className}`}
    >
      <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** A single key/value row inside a detail card. */
export function KV({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-foreground-500 shrink-0">{label}</dt>
      <dd className="truncate text-right font-medium">{children}</dd>
    </div>
  );
}

/** Compact one-line empty state with an optional inline action. */
export function EmptyRow({
  icon: Icon,
  children,
  action,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-default-200 text-foreground-500 flex items-center gap-2.5 rounded-lg border border-dashed px-4 py-2.5 text-sm">
      <Icon className="text-foreground-400 h-4 w-4 shrink-0" />
      <span className="flex-1">{children}</span>
      {action}
    </div>
  );
}
