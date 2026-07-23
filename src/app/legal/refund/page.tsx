import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/legal/legal-page";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description: "How to cancel your ShiftCut AI Copilot subscription and request a refund.",
};

const UPDATED = "July 23, 2026";

export default function RefundPage() {
  return (
    <LegalPage title="Refund & Cancellation Policy" updated={UPDATED}>
      <p>
        This policy applies to the paid <strong>ShiftCut AI Copilot</strong> subscription. The free
        editor requires no payment and is not covered here.
      </p>

      <Section heading="Free trial">
        <p>
          The <strong>yearly</strong> AI Copilot plan starts with a <strong>3-day free trial</strong>.
          If you cancel before the trial ends, you will not be charged. The monthly plan has no trial
          and is billed immediately.
        </p>
      </Section>

      <Section heading="Cancellation">
        <p>
          You can cancel at any time — directly from the Creem billing portal or by emailing{" "}
          <a href={`mailto:${site.contact}`} className="text-accent hover:underline">
            {site.contact}
          </a>
          . Cancellation stops future renewals. You keep access to the AI Copilot until the end of the
          billing period you already paid for.
        </p>
      </Section>

      <Section heading="Refunds">
        <p>
          If you were charged in error, experienced a technical issue that prevented use of the AI
          Copilot, or contact us within <strong>14 days</strong> of a charge for a subscription you did
          not intend to renew, email us and we will review your request in good faith. Approved refunds
          are issued to your original payment method via Creem.
        </p>
        <p>
          Because the underlying AI usage has a real per-request cost, refunds for periods with
          substantial usage may be prorated or declined at our reasonable discretion.
        </p>
      </Section>

      <Section heading="How to request a refund">
        <p>
          Email{" "}
          <a href={`mailto:${site.contact}`} className="text-accent hover:underline">
            {site.contact}
          </a>{" "}
          from the address on your subscription, including the approximate date of the charge. We aim to
          respond within 3 business days.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          {site.company} · {site.contact}
        </p>
      </Section>
    </LegalPage>
  );
}
