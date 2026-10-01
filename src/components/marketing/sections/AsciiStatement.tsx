import { ASCII_STATEMENT } from "../content";
import { RackIllustration } from "../ascii/RackIllustration";
import { Eyebrow } from "../primitives/Eyebrow";

export function AsciiStatement() {
  return (
    <section
      aria-labelledby="ascii-title"
      className="border-mkt-line mkt-reveal border-t py-24 sm:py-32"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <RackIllustration />
        <div>
          <Eyebrow index="02">{ASCII_STATEMENT.eyebrow}</Eyebrow>
          <h2
            id="ascii-title"
            className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            {ASCII_STATEMENT.title}
          </h2>
          <p className="text-mkt-muted mt-5 leading-relaxed">
            {ASCII_STATEMENT.body}
          </p>
          <ul className="font-mkt-mono text-mkt-muted mt-8 space-y-2 text-[12px]">
            {ASCII_STATEMENT.specs.map((s) => (
              <li key={s}>
                <span className="text-mkt-accent" aria-hidden="true">
                  →{" "}
                </span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
