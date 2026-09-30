import { redirect } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createPageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/JsonLd";
import { getBreadcrumbSchema } from "@/lib/structured-data";
import { Eyebrow } from "@/components/marketing/primitives/Eyebrow";

export const metadata = createPageMetadata({
  title: "Privacy Policy",
  description:
    "Learn how Asset Tracker collects, uses, and protects your personal information. GDPR-compliant data handling.",
  path: "/privacy",
});

export default function PrivacyPage() {
  if (isFeatureEnabled("selfHosted")) {
    redirect("/login");
  }
  return (
    <>
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Privacy Policy", path: "/privacy" },
        ])}
      />

      <article className="mx-auto max-w-3xl px-4 pt-20 pb-20 sm:px-6 sm:pt-28 lg:px-8">
        <Eyebrow>LEGAL</Eyebrow>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">
          Privacy Policy
        </h1>
        <p className="font-mkt-mono text-mkt-muted mt-4 text-[12px]">
          Last updated: February 1, 2026
        </p>

        <div className="mt-12">
          {/* Information We Collect */}
          <section className="border-mkt-line mt-10 border-t pt-10 first:mt-0 first:border-t-0 first:pt-0">
            <h2 className="text-xl font-semibold">
              <span
                data-section-no
                className="font-mkt-mono text-mkt-accent mr-3 text-sm"
              >
                {"01"}
              </span>
              1. Information We Collect
            </h2>
            <div className="text-mkt-muted mt-4 space-y-3 text-sm leading-relaxed">
              <p>
                We collect information you provide directly to us when you
                create an account, use the Service, or communicate with us. This
                may include:
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong className="text-mkt-text">
                    Account Information:
                  </strong>{" "}
                  Name, email address, password, organization name, and role.
                </li>
                <li>
                  <strong className="text-mkt-text">Asset Data:</strong>{" "}
                  Information about assets, licenses, consumables, and related
                  records you enter into the Service.
                </li>
                <li>
                  <strong className="text-mkt-text">Usage Data:</strong>{" "}
                  Information about how you use the Service, including pages
                  visited, features used, and actions taken.
                </li>
                <li>
                  <strong className="text-mkt-text">Device Information:</strong>{" "}
                  Browser type, operating system, device identifiers, and IP
                  address.
                </li>
                <li>
                  <strong className="text-mkt-text">
                    Cookies and Tracking:
                  </strong>{" "}
                  We use cookies and similar technologies to maintain your
                  session, remember preferences, and analyze usage patterns.
                </li>
              </ul>
            </div>
          </section>

          {/* How We Use Information */}
          <section className="border-mkt-line mt-10 border-t pt-10 first:mt-0 first:border-t-0 first:pt-0">
            <h2 className="text-xl font-semibold">
              <span
                data-section-no
                className="font-mkt-mono text-mkt-accent mr-3 text-sm"
              >
                {"02"}
              </span>
              2. How We Use Information
            </h2>
            <div className="text-mkt-muted mt-4 space-y-3 text-sm leading-relaxed">
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
          <section className="border-mkt-line mt-10 border-t pt-10 first:mt-0 first:border-t-0 first:pt-0">
            <h2 className="text-xl font-semibold">
              <span
                data-section-no
                className="font-mkt-mono text-mkt-accent mr-3 text-sm"
              >
                {"03"}
              </span>
              3. Data Storage and Security
            </h2>
            <div className="text-mkt-muted mt-4 space-y-3 text-sm leading-relaxed">
              <p>
                We take reasonable measures to help protect your personal
                information from loss, theft, misuse, unauthorized access,
                disclosure, alteration, and destruction. These measures include:
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  Encryption of data in transit (TLS 1.3) and at rest (AES-256).
                </li>
                <li>Regular security audits and vulnerability assessments.</li>
                <li>Access controls and authentication mechanisms.</li>
                <li>Regular backups and disaster recovery procedures.</li>
              </ul>
              <p>
                Your data is stored in secure data centers located within the
                United States and the European Union. We use industry-standard
                infrastructure providers that maintain SOC 2 Type II compliance.
              </p>
            </div>
          </section>

          {/* Third-Party Services */}
          <section className="border-mkt-line mt-10 border-t pt-10 first:mt-0 first:border-t-0 first:pt-0">
            <h2 className="text-xl font-semibold">
              <span
                data-section-no
                className="font-mkt-mono text-mkt-accent mr-3 text-sm"
              >
                {"04"}
              </span>
              4. Third-Party Services
            </h2>
            <div className="text-mkt-muted mt-4 space-y-3 text-sm leading-relaxed">
              <p>
                We may share information with third-party service providers that
                perform services on our behalf, such as:
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
                and are required to maintain the confidentiality and security of
                your information.
              </p>
            </div>
          </section>

          {/* Your Rights (GDPR) */}
          <section className="border-mkt-line mt-10 border-t pt-10 first:mt-0 first:border-t-0 first:pt-0">
            <h2 className="text-xl font-semibold">
              <span
                data-section-no
                className="font-mkt-mono text-mkt-accent mr-3 text-sm"
              >
                {"05"}
              </span>
              5. Your Rights (GDPR)
            </h2>
            <div className="text-mkt-muted mt-4 space-y-3 text-sm leading-relaxed">
              <p>
                If you are located in the European Economic Area (EEA), you have
                certain data protection rights under the General Data Protection
                Regulation (GDPR). These include the right to:
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong className="text-mkt-text">Access:</strong> Request a
                  copy of the personal data we hold about you.
                </li>
                <li>
                  <strong className="text-mkt-text">Rectification:</strong>{" "}
                  Request correction of inaccurate or incomplete personal data.
                </li>
                <li>
                  <strong className="text-mkt-text">Erasure:</strong> Request
                  deletion of your personal data under certain circumstances.
                </li>
                <li>
                  <strong className="text-mkt-text">Restriction:</strong>{" "}
                  Request restriction of processing of your personal data.
                </li>
                <li>
                  <strong className="text-mkt-text">Portability:</strong>{" "}
                  Request transfer of your personal data to another service.
                </li>
                <li>
                  <strong className="text-mkt-text">Objection:</strong> Object
                  to the processing of your personal data for certain purposes.
                </li>
              </ul>
              <p>
                To exercise any of these rights, please contact us at the email
                address provided below. We will respond to your request within
                30 days.
              </p>
            </div>
          </section>

          {/* Data Retention */}
          <section className="border-mkt-line mt-10 border-t pt-10 first:mt-0 first:border-t-0 first:pt-0">
            <h2 className="text-xl font-semibold">
              <span
                data-section-no
                className="font-mkt-mono text-mkt-accent mr-3 text-sm"
              >
                {"06"}
              </span>
              6. Data Retention
            </h2>
            <div className="text-mkt-muted mt-4 space-y-3 text-sm leading-relaxed">
              <p>
                We retain your personal information for as long as your account
                is active or as needed to provide you with the Service. We will
                also retain and use your information as necessary to comply with
                our legal obligations, resolve disputes, and enforce our
                agreements.
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
          <section className="border-mkt-line mt-10 border-t pt-10 first:mt-0 first:border-t-0 first:pt-0">
            <h2 className="text-xl font-semibold">
              <span
                data-section-no
                className="font-mkt-mono text-mkt-accent mr-3 text-sm"
              >
                {"07"}
              </span>
              7. Contact
            </h2>
            <div className="text-mkt-muted mt-4 space-y-3 text-sm leading-relaxed">
              <p>
                If you have any questions or concerns about this Privacy Policy
                or our data practices, please contact us at:
              </p>
              <div className="border-mkt-line bg-muted/30 mt-3 rounded-lg border p-4">
                <p>
                  <strong className="text-mkt-text">Asset Tracker, Inc.</strong>
                </p>
                <p>Email: privacy@assettracker.io</p>
                <p>
                  Address: 123 Innovation Drive, Suite 400, Wilmington, DE
                  19801, United States
                </p>
              </div>
              <p>
                For EEA residents, you also have the right to lodge a complaint
                with your local data protection authority if you believe we have
                not adequately addressed your concerns.
              </p>
            </div>
          </section>
        </div>
      </article>
    </>
  );
}
