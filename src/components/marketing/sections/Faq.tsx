import { ChevronDown } from "lucide-react";
import { LANDING_FAQ } from "@/lib/seo";
import { FAQ_HEADING } from "../content";
import { Eyebrow } from "../primitives/Eyebrow";

export function Faq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="border-mkt-line border-t py-24 sm:py-32"
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Eyebrow>{FAQ_HEADING.eyebrow}</Eyebrow>
        <h2
          id="faq-title"
          className="mt-4 text-3xl font-semibold tracking-tight"
        >
          {FAQ_HEADING.title}
        </h2>
        <div className="border-mkt-line divide-mkt-line mt-10 divide-y border-y">
          {LANDING_FAQ.map((f) => (
            <details key={f.question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                {f.question}
                <ChevronDown
                  aria-hidden="true"
                  className="text-mkt-muted h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="text-mkt-muted mt-3 text-sm leading-relaxed">
                {f.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
