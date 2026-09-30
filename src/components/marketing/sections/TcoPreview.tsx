import { TCO } from "../content";
import { SAMPLE_TCO } from "../sample-data";
import { Eyebrow } from "../primitives/Eyebrow";
import { ProductWindow } from "../primitives/ProductWindow";

const MAX = Math.max(...SAMPLE_TCO.map((r) => r.purchase + r.maintenance));
const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function TcoPreview() {
  return (
    <section
      aria-labelledby="tco-title"
      className="border-mkt-line mkt-reveal border-t py-24 sm:py-32"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[2fr_3fr] lg:px-8">
        <div>
          <Eyebrow index="03">{TCO.eyebrow}</Eyebrow>
          <h2
            id="tco-title"
            className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            {TCO.title}
          </h2>
          <p className="text-mkt-muted mt-5 leading-relaxed">{TCO.body}</p>
          <p className="font-mkt-mono text-mkt-muted mt-6 text-[11px]">
            {TCO.footer}
          </p>
        </div>
        <ProductWindow title="app / tco · 3 years">
          <ul className="font-mkt-mono space-y-4 p-5 text-[12px]">
            {SAMPLE_TCO.map((r) => (
              <li key={r.label}>
                <div className="flex justify-between">
                  <span>{r.label}</span>
                  <span className="text-mkt-muted">
                    {eur.format(r.purchase + r.maintenance)}
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="bg-mkt-line mt-1.5 flex h-2 overflow-hidden rounded-[2px]"
                >
                  <span
                    className="bg-mkt-accent"
                    style={{ width: `${(r.purchase / MAX) * 100}%` }}
                  />
                  <span
                    className="bg-mkt-warn"
                    style={{ width: `${(r.maintenance / MAX) * 100}%` }}
                  />
                </div>
              </li>
            ))}
            <li
              aria-hidden="true"
              className="text-mkt-muted flex gap-4 pt-2 text-[10px]"
            >
              <span>
                <span className="bg-mkt-accent mr-1.5 inline-block h-2 w-2" />
                purchase
              </span>
              <span>
                <span className="bg-mkt-warn mr-1.5 inline-block h-2 w-2" />
                maintenance
              </span>
            </li>
          </ul>
        </ProductWindow>
      </div>
    </section>
  );
}
