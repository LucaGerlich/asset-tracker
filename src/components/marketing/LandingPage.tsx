import { AsciiStatement } from "./sections/AsciiStatement";
import { DeployOptions } from "./sections/DeployOptions";
import { FactStrip } from "./sections/FactStrip";
import { Faq } from "./sections/Faq";
import { FinalCta } from "./sections/FinalCta";
import { Hero } from "./sections/Hero";
import { SchematicGrid } from "./sections/SchematicGrid";
import { TcoPreview } from "./sections/TcoPreview";

export function LandingPage() {
  return (
    <>
      <Hero />
      <FactStrip />
      <SchematicGrid />
      <AsciiStatement />
      <TcoPreview />
      <DeployOptions />
      <Faq />
      <FinalCta />
    </>
  );
}
