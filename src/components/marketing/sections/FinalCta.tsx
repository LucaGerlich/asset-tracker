import Link from "next/link";
import { FINAL_CTA, MARKETING_LINKS } from "../content";
import { BlockCursor } from "../primitives/BlockCursor";

export function FinalCta() {
  return (
    <section
      aria-labelledby="cta-title"
      className="border-mkt-line relative overflow-hidden border-t"
    >
      <div
        aria-hidden="true"
        className="mkt-grid pointer-events-none absolute inset-0"
      />
      <div className="relative mx-auto max-w-3xl px-4 py-28 text-center sm:px-6">
        <h2
          id="cta-title"
          className="text-4xl font-semibold tracking-tight sm:text-5xl"
        >
          {FINAL_CTA.title}
          <BlockCursor />
        </h2>
        <p className="text-mkt-muted mt-4">{FINAL_CTA.sub}</p>
        <div className="mt-9 flex items-center justify-center gap-4">
          <Link
            href={MARKETING_LINKS.register}
            className="bg-mkt-accent-fill text-mkt-accent-fill-fg rounded-md px-5 py-2.5 text-sm font-medium"
          >
            Start free →
          </Link>
          <Link
            href={MARKETING_LINKS.login}
            className="text-mkt-muted hover:text-mkt-text text-sm"
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
