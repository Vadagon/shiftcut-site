import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/legal/legal-page";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms governing use of ShiftCut and the ShiftCut AI Copilot subscription.",
};

const UPDATED = "July 23, 2026";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated={UPDATED}>
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the ShiftCut website,
        editor, and the ShiftCut AI Copilot subscription (together, the &ldquo;Service&rdquo;),
        provided by {site.company} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By using the Service you
        agree to these Terms. If you do not agree, do not use the Service.
      </p>

      <Section heading="1. The Service">
        <p>
          ShiftCut is an AI-native video editor. The editor, local timeline editing, on-device MP4
          export, and MCP access (bringing your own agent such as Codex, Claude Code, or Gemini) are
          free and run locally in your browser. The optional <strong>AI Copilot</strong> is a paid
          subscription that provides in-editor, natural-language editing powered by a third-party
          model provider.
        </p>
      </Section>

      <Section heading="2. Accounts">
        <p>
          No account is required to use the free editor. An account (your email) is required only to
          subscribe to the AI Copilot and to manage billing. You are responsible for keeping your
          account details accurate and for activity under your subscription.
        </p>
      </Section>

      <Section heading="3. Subscriptions, trials, and billing">
        <p>
          The AI Copilot is offered at <strong>$10 per month</strong> or <strong>$60 per year</strong>.
          The yearly plan includes a <strong>3-day free trial</strong>; the monthly plan bills
          immediately. Payments are processed by our merchant of record, <strong>Creem</strong>. By
          starting a subscription you authorize Creem to charge your payment method on a recurring basis
          until you cancel. Unless you cancel during the trial (yearly plan), the subscription begins and
          renews automatically at the end of each billing period.
        </p>
        <p>
          You may cancel at any time via the billing portal or by contacting us. Cancellation stops
          future renewals; you retain access until the end of the current paid period. See our Refund
          &amp; Cancellation policy for details.
        </p>
      </Section>

      <Section heading="4. Acceptable Use Policy">
        <p>
          You may not use the Service — including any AI generation or editing feature, and whether
          the content is uploaded, edited, or generated from a prompt — to create, request, process,
          or distribute:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>NSFW, pornographic, or sexually explicit content of any kind.</strong> The
            generation or editing of adult, nude, pornographic, or sexually explicit imagery, video,
            audio, or text is strictly prohibited on the Service.
          </li>
          <li>
            Child sexual abuse material (CSAM) or any sexual content involving minors, real or
            simulated.
          </li>
          <li>
            Non-consensual sexual or intimate content, or sexualized “deepfakes” or depictions of a
            real person without their consent.
          </li>
          <li>
            Content that is unlawful, that infringes others&rsquo; intellectual-property or privacy
            rights, that promotes violence, self-harm, hate, or harassment, or that is designed to
            deceive or defraud.
          </li>
          <li>
            Anything that violates our model providers&rsquo; or our payment processor Creem&rsquo;s
            acceptable-use or content policies.
          </li>
        </ul>
        <p>
          Every prompt submitted to an AI generation or editing feature is screened by an automated
          content-moderation system before it is processed, and prohibited requests are blocked. We
          may also review, suspend, or terminate accounts that violate this policy, and report
          unlawful content to the appropriate authorities.
        </p>
      </Section>

      <Section heading="5. Your content">
        <p>
          Your video projects and media are stored locally in your browser and are not uploaded to our
          servers. When you use the AI Copilot, the text of your instructions (and minimal composition
          context) is sent to our server and model provider solely to generate edits. You retain all
          rights to your content.
        </p>
      </Section>

      <Section heading="6. Open source">
        <p>
          The ShiftCut editor and framework are released under the Apache-2.0 license. Your use of the
          open-source components is governed by that license.
        </p>
      </Section>

      <Section heading="7. Disclaimers & liability">
        <p>
          The Service is provided &ldquo;as is&rdquo; without warranties of any kind. To the maximum
          extent permitted by law, {site.company} is not liable for indirect or consequential damages,
          and our total liability is limited to the amount you paid for the Service in the 12 months
          preceding the claim.
        </p>
      </Section>

      <Section heading="8. Changes">
        <p>
          We may update these Terms. Material changes will be reflected by the &ldquo;Last updated&rdquo;
          date above. Continued use after changes constitutes acceptance.
        </p>
      </Section>

      <Section heading="9. Contact">
        <p>
          Questions about these Terms? Email{" "}
          <a href={`mailto:${site.contact}`} className="text-accent hover:underline">
            {site.contact}
          </a>
          . {site.company}.
        </p>
      </Section>
    </LegalPage>
  );
}
