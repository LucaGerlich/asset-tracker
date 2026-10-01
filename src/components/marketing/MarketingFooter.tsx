import Link from "next/link";
import packageJson from "../../../package.json";
import { MARKETING_LINKS } from "./content";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: MARKETING_LINKS.features, label: "Features" },
      { href: MARKETING_LINKS.pricing, label: "Pricing" },
      { href: MARKETING_LINKS.github, label: "GitHub" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: MARKETING_LINKS.terms, label: "Terms" },
      { href: MARKETING_LINKS.privacy, label: "Privacy" },
    ],
  },
  {
    title: "Get started",
    links: [
      { href: MARKETING_LINKS.register, label: "Create account" },
      { href: MARKETING_LINKS.login, label: "Sign in" },
    ],
  },
] as const;

export function MarketingFooter() {
  return (
    <footer className="border-mkt-line border-t">
      <div className="border-mkt-line mx-auto grid max-w-7xl grid-cols-2 md:grid-cols-4 xl:border-x">
        <div className="border-mkt-line col-span-2 border-b p-6 md:col-span-1 md:border-r md:border-b-0">
          <p className="font-mkt-mono text-sm font-medium">Asset Tracker</p>
          <p className="text-mkt-muted mt-3 text-sm">
            Open-source IT asset management. MIT licensed.
          </p>
        </div>
        {COLUMNS.map((col, i) => (
          <div
            key={col.title}
            className={`border-mkt-line p-6 ${i === 0 ? "border-r" : ""} ${i === 1 ? "md:border-r" : ""} ${i === 2 ? "col-span-2 border-t md:col-span-1 md:border-t-0" : ""}`}
          >
            <p className="font-mkt-mono text-mkt-muted text-[11px] tracking-widest uppercase">
              {col.title}
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-mkt-muted hover:text-mkt-text transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-mkt-line font-mkt-mono text-mkt-muted border-t">
        <div className="mx-auto flex max-w-7xl justify-between px-6 py-4 text-[11px]">
          <span>© {new Date().getFullYear()} Asset Tracker</span>
          <span>v{packageJson.version}</span>
        </div>
      </div>
    </footer>
  );
}
