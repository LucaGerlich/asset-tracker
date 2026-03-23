import { Metadata } from "next";
import { redirect } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

export const metadata: Metadata = {
  title: "Asset Tracker - Terms of Service",
  description: "Terms of service for using the Asset Tracker platform.",
};

export default function TermsPage() {
  if (isFeatureEnabled("selfHosted")) {
    redirect("/login");
  }
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <MarketingNav />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 pt-24 pb-20 sm:px-6 sm:pt-32 lg:px-8">
          <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
            Terms of Service
          </h1>
          <p className="text-muted-foreground mt-4 text-sm">
            Last updated: February 1, 2026
          </p>

          <div className="mt-12 space-y-10">
            {/* Terms of Use */}
            <section>
              <h2 className="text-foreground text-xl font-semibold">
                1. Terms of Use
              </h2>
              <div className="text-muted-foreground mt-4 space-y-3 text-sm leading-relaxed">
                <p>
                  By accessing and using Asset Tracker (&quot;the
                  Service&quot;), you agree to be bound by these Terms of
                  Service (&quot;Terms&quot;). If you do not agree with any part
                  of these Terms, you may not use the Service.
                </p>
                <p>
                  The Service is provided by Asset Tracker, Inc.
                  (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). We
                  reserve the right to modify these Terms at any time. Continued
                  use of the Service following any changes constitutes
                  acceptance of those changes.
                </p>
                <p>
                  You must be at least 18 years old to use this Service. By
                  using the Service, you represent and warrant that you meet
                  this age requirement and have the legal capacity to enter into
                  a binding agreement.
                </p>
              </div>
            </section>

            {/* Acceptable Use */}
            <section>
              <h2 className="text-foreground text-xl font-semibold">
                2. Acceptable Use
              </h2>
              <div className="text-muted-foreground mt-4 space-y-3 text-sm leading-relaxed">
                <p>
                  You agree to use the Service only for lawful purposes and in
                  accordance with these Terms. You agree not to:
                </p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    Use the Service in any way that violates any applicable
                    federal, state, local, or international law or regulation.
                  </li>
                  <li>
                    Attempt to gain unauthorized access to, interfere with,
                    damage, or disrupt any parts of the Service, the server on
                    which the Service is stored, or any server, computer, or
                    database connected to the Service.
                  </li>
                  <li>
                    Introduce any viruses, trojans, worms, logic bombs, or other
                    material that is malicious or technologically harmful.
                  </li>
                  <li>
                    Use the Service to transmit, or procure the sending of, any
                    unsolicited or unauthorized advertising or promotional
                    material.
                  </li>
                  <li>
                    Use the Service in any manner that could disable,
                    overburden, damage, or impair the Service or interfere with
                    any other party&apos;s use of the Service.
                  </li>
                </ul>
              </div>
            </section>

            {/* Data Ownership */}
            <section>
              <h2 className="text-foreground text-xl font-semibold">
                3. Data Ownership
              </h2>
              <div className="text-muted-foreground mt-4 space-y-3 text-sm leading-relaxed">
                <p>
                  You retain all rights to the data you upload, store, or
                  process through the Service (&quot;Your Data&quot;). We do not
                  claim ownership of Your Data and will not use it for any
                  purpose other than to provide and improve the Service.
                </p>
                <p>
                  You grant us a limited, non-exclusive license to use, process,
                  and store Your Data solely for the purpose of providing the
                  Service to you and as otherwise described in our Privacy
                  Policy.
                </p>
                <p>
                  You are responsible for maintaining backups of Your Data.
                  While we take reasonable measures to protect Your Data, we are
                  not liable for any loss or corruption of data.
                </p>
              </div>
            </section>

            {/* Limitation of Liability */}
            <section>
              <h2 className="text-foreground text-xl font-semibold">
                4. Limitation of Liability
              </h2>
              <div className="text-muted-foreground mt-4 space-y-3 text-sm leading-relaxed">
                <p>
                  To the fullest extent permitted by applicable law, in no event
                  shall Asset Tracker, Inc., its affiliates, officers,
                  directors, employees, agents, or licensors be liable for any
                  indirect, incidental, special, consequential, or punitive
                  damages, including without limitation, loss of profits, data,
                  use, goodwill, or other intangible losses, resulting from:
                </p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    Your access to or use of, or inability to access or use, the
                    Service.
                  </li>
                  <li>
                    Any conduct or content of any third party on the Service.
                  </li>
                  <li>Any content obtained from the Service.</li>
                  <li>
                    Unauthorized access, use, or alteration of your
                    transmissions or content.
                  </li>
                </ul>
                <p>
                  Our total liability for all claims arising out of or related
                  to these Terms or the Service shall not exceed the amount you
                  paid us in the twelve (12) months preceding the claim.
                </p>
              </div>
            </section>

            {/* Termination */}
            <section>
              <h2 className="text-foreground text-xl font-semibold">
                5. Termination
              </h2>
              <div className="text-muted-foreground mt-4 space-y-3 text-sm leading-relaxed">
                <p>
                  We may terminate or suspend your access to the Service
                  immediately, without prior notice or liability, for any reason
                  whatsoever, including without limitation if you breach these
                  Terms.
                </p>
                <p>
                  Upon termination, your right to use the Service will
                  immediately cease. Your Data will remain available for export
                  for 30 days following termination, after which it will be
                  permanently deleted.
                </p>
                <p>
                  You may terminate your account at any time by contacting us or
                  using the account deletion feature within the Service. All
                  provisions of the Terms which by their nature should survive
                  termination shall survive, including ownership provisions,
                  warranty disclaimers, and limitations of liability.
                </p>
              </div>
            </section>

            {/* Governing Law */}
            <section>
              <h2 className="text-foreground text-xl font-semibold">
                6. Governing Law
              </h2>
              <div className="text-muted-foreground mt-4 space-y-3 text-sm leading-relaxed">
                <p>
                  These Terms shall be governed by and construed in accordance
                  with the laws of the State of Delaware, United States, without
                  regard to its conflict of law provisions.
                </p>
                <p>
                  Any disputes arising out of or relating to these Terms or the
                  Service shall be resolved exclusively in the federal or state
                  courts located in Wilmington, Delaware. You consent to the
                  personal jurisdiction of such courts.
                </p>
                <p>
                  If any provision of these Terms is held to be invalid or
                  unenforceable, the remaining provisions shall continue in full
                  force and effect. Our failure to enforce any right or
                  provision of these Terms shall not be considered a waiver of
                  those rights.
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
