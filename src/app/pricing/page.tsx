import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CheckIcon } from "@/components/icons";
import { CheckoutButton } from "@/components/pricing/checkout-button";
import { plans, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "ShiftCut is free forever with your own agent (Codex, Claude, Gemini). The built-in AI copilot is $10/mo, or $60/yr with a 3-day free trial. Billed securely via Creem.",
};

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-5 py-16 text-center sm:px-8">
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Free with your own agent. <br className="hidden sm:block" />
              <span className="text-gradient-accent">$10/mo for the built-in copilot.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-fg-muted">
              The editor, local MP4 export, and MCP access are free forever — bring Codex,
              Claude Code, or Gemini and pay nothing. Only the in-editor AI copilot is paid.
              Go yearly to start with a 3-day free trial.
            </p>
          </div>
        </section>

        <section>
          <div className="mx-auto grid max-w-6xl gap-6 px-5 py-16 sm:px-8 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`flex flex-col rounded-2xl border p-6 ${
                  plan.highlight
                    ? "border-accent bg-accent-soft/30 shadow-lg shadow-accent/5"
                    : "border-border bg-surface/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold text-fg">{plan.name}</h2>
                  {"badge" in plan && plan.badge && (
                    <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
                      {plan.badge}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-4xl font-semibold tracking-tight">{plan.price}</span>
                  <span className="text-sm text-fg-subtle">{plan.cadence}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{plan.tagline}</p>

                <div className="mt-6">
                  {plan.creemPlan ? (
                    <CheckoutButton
                      plan={plan.creemPlan}
                      label={plan.cta}
                      highlight={plan.highlight}
                    />
                  ) : (
                    <Link
                      href={plan.ctaHref ?? "/editor"}
                      className="inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-fg transition-colors hover:border-border-strong"
                    >
                      {plan.cta}
                    </Link>
                  )}
                </div>

                <ul className="mt-6 space-y-3 border-t border-border pt-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13px] text-fg-muted">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                        <CheckIcon className="h-2.5 w-2.5" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Trust / compliance strip — clear billing terms for the Creem review. */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
            <h2 className="text-center text-lg font-semibold">Billing you can trust</h2>
            <dl className="mt-8 space-y-6">
              {[
                {
                  q: "How does the 3-day free trial work?",
                  a: "The 3-day free trial is included with the yearly plan. Start it and use the AI Copilot free for 3 days — cancel anytime during the trial from the billing portal and you won't be charged. After the trial, it renews at $60/year until you cancel. The monthly plan has no trial and bills right away.",
                },
                {
                  q: "How do I cancel?",
                  a: "Cancel anytime — directly from the Creem billing portal linked in your account, or by emailing us. Cancellation stops future renewals; you keep access until the end of the paid period.",
                },
                {
                  q: "Who processes payments?",
                  a: "Payments are securely processed by Creem, our merchant of record. ShiftCut never sees or stores your card details.",
                },
                {
                  q: "Refunds?",
                  a: (
                    <>
                      See our{" "}
                      <Link href="/legal/refund" className="text-accent hover:underline">
                        Refund &amp; Cancellation policy
                      </Link>
                      . Questions? Email{" "}
                      <a href={`mailto:${site.contact}`} className="text-accent hover:underline">
                        {site.contact}
                      </a>
                      .
                    </>
                  ),
                },
              ].map((item) => (
                <div key={item.q}>
                  <dt className="text-sm font-medium text-fg">{item.q}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-fg-muted">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
