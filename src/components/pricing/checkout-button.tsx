"use client";

import { useState } from "react";

type Props = {
  plan: "monthly" | "yearly";
  label: string;
  highlight?: boolean;
};

// Kicks off a Creem hosted checkout for the given plan.
// Before Creem keys are configured the API returns 503; we surface that inline.
export function CheckoutButton({ plan, label, highlight }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/creem/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json().catch(() => null)) as { checkoutUrl?: string; error?: string } | null;
      if (!res.ok || !data?.checkoutUrl) {
        setError(data?.error ?? "Checkout is not available yet.");
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      setError("Could not start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${
          highlight
            ? "bg-accent text-bg hover:bg-accent-hover"
            : "border border-border text-fg hover:border-border-strong"
        }`}
      >
        {loading ? "Starting…" : label}
      </button>
      {error && <p className="mt-2 text-center text-xs text-fg-subtle">{error}</p>}
    </div>
  );
}
