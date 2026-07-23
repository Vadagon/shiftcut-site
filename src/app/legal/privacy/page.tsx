import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/legal/legal-page";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How ShiftCut handles your data. Projects stay local; billing is handled by Creem.",
};

const UPDATED = "July 23, 2026";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={UPDATED}>
      <p>
        This Privacy Policy explains how {site.company} (&ldquo;we&rdquo;) handles information in
        connection with ShiftCut (the &ldquo;Service&rdquo;). We built ShiftCut to be local-first: by
        default, your work never leaves your device.
      </p>

      <Section heading="1. Data stored on your device">
        <p>
          Your projects, media, and edit history are stored locally in your browser (IndexedDB and
          OPFS). We do not upload, host, or have access to your video files.
        </p>
      </Section>

      <Section heading="2. Information we process">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>AI Copilot inputs:</strong> when you use the paid copilot, the text of your
            instructions and minimal composition context are sent to our server and a third-party
            model provider to generate edits. These are used to fulfill your request and for abuse
            prevention, not to build advertising profiles.
          </li>
          <li>
            <strong>Account &amp; billing:</strong> if you subscribe, we and our payment processor
            <strong> Creem</strong> process your email and subscription status. Card details are
            handled by Creem, not us.
          </li>
          <li>
            <strong>Basic operational logs:</strong> standard request logs for security and
            reliability.
          </li>
        </ul>
      </Section>

      <Section heading="3. Payment processing">
        <p>
          Payments are processed by <strong>Creem</strong>, our merchant of record. Creem collects and
          processes your payment information under its own privacy policy. We receive only the
          information needed to provision and manage your subscription (such as email, plan, and
          status).
        </p>
      </Section>

      <Section heading="4. Content moderation">
        <p>
          To comply with our processor&rsquo;s and model providers&rsquo; policies, AI Copilot inputs
          are screened through a content-moderation service before processing.
        </p>
      </Section>

      <Section heading="5. Sharing">
        <p>
          We do not sell your personal data. We share data only with service providers who help us run
          the Service (payment processing, model inference, moderation, hosting), and where required by
          law.
        </p>
      </Section>

      <Section heading="6. Retention">
        <p>
          Local project data is retained on your device until you delete it. Billing records are
          retained as required for legal and accounting purposes.
        </p>
      </Section>

      <Section heading="7. Your rights">
        <p>
          You may request access to, correction of, or deletion of your account and billing data by
          emailing us. You can delete local project data at any time from your browser.
        </p>
      </Section>

      <Section heading="8. Contact">
        <p>
          Privacy questions? Email{" "}
          <a href={`mailto:${site.contact}`} className="text-accent hover:underline">
            {site.contact}
          </a>
          . {site.company}.
        </p>
      </Section>
    </LegalPage>
  );
}
