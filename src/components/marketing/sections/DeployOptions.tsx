import Link from "next/link";
import { DEPLOY, MARKETING_LINKS } from "../content";
import { CopyCommand } from "../primitives/CopyCommand";
import { Eyebrow } from "../primitives/Eyebrow";

export function DeployOptions() {
  return (
    <section
      aria-labelledby="deploy-title"
      className="border-mkt-line mkt-reveal border-t py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Eyebrow index="04">{DEPLOY.eyebrow}</Eyebrow>
        <h2
          id="deploy-title"
          className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          {DEPLOY.title}
        </h2>
        <div className="border-mkt-line bg-mkt-line mt-12 grid gap-px overflow-hidden rounded-xl border md:grid-cols-2">
          <div className="bg-mkt-surface min-w-0 p-6 sm:p-8">
            <h3 className="font-semibold">{DEPLOY.selfHost.title}</h3>
            <p className="text-mkt-muted mt-2 text-sm">
              {DEPLOY.selfHost.body}
            </p>
            <div className="mt-6 max-w-full">
              <CopyCommand command={DEPLOY.selfHost.command} />
            </div>
            <Link
              href={MARKETING_LINKS.github}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mkt-mono text-mkt-accent mt-6 inline-block text-[12px] break-all"
            >
              github.com/LucaGerlich/asset-tracker →
            </Link>
          </div>
          <div className="bg-mkt-surface min-w-0 p-6 sm:p-8">
            <h3 className="font-semibold">{DEPLOY.cloud.title}</h3>
            <p className="text-mkt-muted mt-2 text-sm">{DEPLOY.cloud.body}</p>
            <Link
              href={MARKETING_LINKS.pricing}
              className="bg-mkt-accent-fill text-mkt-accent-fill-fg mt-6 inline-block rounded-md px-4 py-2 text-sm font-medium"
            >
              See pricing →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
