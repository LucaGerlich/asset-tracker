import { Metadata } from "next";
import { redirect } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

export const metadata: Metadata = {
  title: "Asset Tracker - Privacy Policy",
  description:
    "Learn how Asset Tracker collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
  if (isFeatureEnabled("selfHosted")) {
    redirect("/login");
  }
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <MarketingNav />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 pt-24 pb-20 sm:px-6 sm:pt-32 lg:px-8">
          <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground mt-4 text-sm">
            Last updated: February 1, 2026
          </p>

          <div className="mt-12 space-y-10">
            {/* Information We Collect */}
            <section>
              <h2 className="text-foreground text-xl font-semibold">
                1. Information We Collect
              </h2>
              <div className="text-muted-foreground mt-4 space-y-3 text-sm leading-relaxed">
                <p>
                  We collect information you provide directly to us when you
                  create an account, use the Service, or communicate with us.
                  This may include:
                </p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    <strong className="text-foreground">
                      Account Information:
                    </strong>{" "}
                    Name, email address, password, organization name, and role.
                  </li>
                  <li>
                    <strong className="text-foreground">Asset Data:</strong>{" "}
                    Information about assets, licenses, consumables, and related
                    records you enter into the Service.
                  </li>
                  <li>
                    <strong className="text-foreground">Usage Data:</strong>{" "}
                    Information about how you use the Service, including pages
                    visited, features used, and actions taken.
                  </li>
                  <li>
                    <strong className="text-foreground">
                      Device Information:
                    </strong>{" "}
                    Browser type, operating system, device identifiers, and IP
                    address.
                  </li>
                  <li>
                    <strong className="text-foreground">
                      Cookies and Tracking:
                    </strong>{" "}
                    We use cookies and similar technologies to maintain your
                    session, remember preferences, and analyze usage patterns.
                  </li>
                </ul>
              </div>
            </section>

            {/* How We Use Information */}
            <section>
              <h2 className="text-foreground text-xl font-semibold">
                2. How We Use Information
              </h2>
              <div className="text-muted-foreground mt-4 space-y-3 text-sm leading-relaxed">
                <p>We use the information we collect to:</p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>Provide, maintain, and improve the Service.</li>
                  <li>
                    Process transactions and send related information, including
                    confirmations and invoices.
                  </li>
                  <li>
                    Send you technical notices, updates, security alerts, and
                    support messages.
                  </li>
                  <li>
                    Respond to your comments, questions, and customer service
                    requests.
                  </li>
                  <li>
                    Monitor and analyze trends, usage, and activities in
                    connection with the Service.
                  </li>
                  <li>
                    Detect, investigate, and prevent fraudulent transactions and
                    other illegal activities and protect the rights and property
                    of Asset Tracker and others.
                  </li>
                </ul>
              </div>
            </section>

            {/* Data Storage and Security */}
            <section>
              <h2 className="text-foreground text-xl font-semibold">
                3. Data Storage and Security
              </h2>
              <div className="text-muted-foreground mt-4 space-y-3 text-sm leading-relaxed">
                <p>
                  We take reasonable measures to help protect your personal
                  information from loss, theft, misuse, unauthorized access,
                  disclosure, alteration, and destruction. These measures
                  include:
                </p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    Encryption of data in transit (TLS 1.3) and at rest
                    (AES-256).
                  </li>
                  <li>
                    Regular security audits and vulnerability assessments.
                  </li>
                  <li>Access controls and authentication mechanisms.</li>
                  <li>Regular backups and disaster recovery procedures.</li>
                </ul>
                <p>
                  Your data is stored in secure data centers located within the
                  United States and the European Union. We use industry-standard
                  infrastructure providers that maintain SOC 2 Type II
                  compliance.
                </p>
              </div>
            </section>

            {/* Third-Party Services */}
            <section>
              <h2 className="text-foreground text-xl font-semibold">
                4. Third-Party Services
              </h2>
              <div className="text-muted-foreground mt-4 space-y-3 text-sm leading-relaxed">
                <p>
                  We may share information with third-party service providers
                  that perform services on our behalf, such as:
                </p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>Cloud hosting and infrastructure providers.</li>
                  <li>
                    Payment processors for billing and subscription management.
                  </li>
                  <li>
                    Analytics services to understand Service usage and improve
                    performance.
                  </li>
                  <li>
                    Email delivery services for transactional and notification
                    emails.
                  </li>
                  <li>Customer support tools for managing support requests.</li>
                </ul>
                <p>
                  These third parties are contractually obligated to use your
                  information only as necessary to provide their services to us
                  and are required to maintain the confidentiality and security
                  of your information.
                </p>
              </div>
            </section>

            {/* Your Rights (GDPR) */}
            <section>
              <h2 className="text-foreground text-xl font-semibold">
                5. Your Rights (GDPR)
              </h2>
              <div className="text-muted-foreground mt-4 space-y-3 text-sm leading-relaxed">
                <p>
                  If you are located in the European Economic Area (EEA), you
                  have certain data protection rights under the General Data
                  Protection Regulation (GDPR). These include the right to:
                </p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    <strong className="text-foreground">Access:</strong> Request
                    a copy of the personal data we hold about you.
                  </li>
                  <li>
                    <strong className="text-foreground">Rectification:</strong>{" "}
                    Request correction of inaccurate or incomplete personal
                    data.
                  </li>
                  <li>
                    <strong className="text-foreground">Erasure:</strong>{" "}
                    Request deletion of your personal data under certain
                    circumstances.
                  </li>
                  <li>
                    <strong className="text-foreground">Restriction:</strong>{" "}
                    Request restriction of processing of your personal data.
                  </li>
                  <li>
                    <strong className="text-foreground">Portability:</strong>{" "}
                    Request transfer of your personal data to another service.
                  </li>
                  <li>
                    <strong className="text-foreground">Objection:</strong>{" "}
                    Object to the processing of your personal data for certain
                    purposes.
                  </li>
                </ul>
                <p>
                  To exercise any of these rights, please contact us at the
                  email address provided below. We will respond to your request
                  within 30 days.
                </p>
              </div>
            </section>

            {/* Data Retention */}
            <section>
              <h2 className="text-foreground text-xl font-semibold">
                6. Data Retention
              </h2>
              <div className="text-muted-foreground mt-4 space-y-3 text-sm leading-relaxed">
                <p>
                  We retain your personal information for as long as your
                  account is active or as needed to provide you with the
                  Service. We will also retain and use your information as
                  necessary to comply with our legal obligations, resolve
                  disputes, and enforce our agreements.
                </p>
                <p>
                  When you delete your account, we will delete or anonymize your
                  personal data within 30 days, except where we are required to
                  retain certain information by law or for legitimate business
                  purposes such as fraud prevention.
                </p>
                <p>
                  Aggregate, anonymized data that cannot be used to identify you
                  may be retained indefinitely for analytical and statistical
                  purposes.
                </p>
              </div>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-foreground text-xl font-semibold">
                7. Contact
              </h2>
              <div className="text-muted-foreground mt-4 space-y-3 text-sm leading-relaxed">
                <p>
                  If you have any questions or concerns about this Privacy
                  Policy or our data practices, please contact us at:
                </p>
                <div className="border-border bg-muted/30 mt-3 rounded-lg border p-4">
                  <p>
                    <strong className="text-foreground">
                      Asset Tracker, Inc.
                    </strong>
                  </p>
                  <p>Email: privacy@assettracker.io</p>
                  <p>
                    Address: 123 Innovation Drive, Suite 400, Wilmington, DE
                    19801, United States
                  </p>
                </div>
                <p>
                  For EEA residents, you also have the right to lodge a
                  complaint with your local data protection authority if you
                  believe we have not adequately addressed your concerns.
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
