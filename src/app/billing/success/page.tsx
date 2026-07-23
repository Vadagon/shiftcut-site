import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "You're all set",
  description: "Your ShiftCut AI Copilot subscription is active.",
};

export default function BillingSuccessPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-xl px-5 py-24 text-center sm:px-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-2xl text-accent">
            ✓
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">You&rsquo;re all set</h1>
          <p className="mx-auto mt-4 max-w-md text-pretty leading-relaxed text-fg-muted">
            Your AI Copilot trial has started. Open the editor and just type what you want — the
            copilot will do the editing. You can manage or cancel your subscription anytime from the
            billing portal.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/editor"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg transition-colors hover:bg-accent-hover"
            >
              Open the editor
            </Link>
            <Link
              href="/legal/refund"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-3 text-sm font-medium text-fg transition-colors hover:border-border-strong"
            >
              Cancellation &amp; refunds
            </Link>
          </div>
          <p className="mt-6 font-mono text-xs text-fg-subtle">
            Questions? {site.contact}
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
