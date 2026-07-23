// Creem payment gateway — server-side only.
//
// Keys/product IDs are wired via environment variables and can be dropped in
// later without code changes. See CREEM-SETUP.md for the full list.
//
//   CREEM_API_KEY            — secret API key (x-api-key header)
//   CREEM_MODE               — "test" | "live" (defaults to "test")
//   CREEM_WEBHOOK_SECRET     — HMAC-SHA256 secret for webhook verification
//   CREEM_PRODUCT_ID_MONTHLY — product id for the $10/mo AI Copilot (no trial)
//   CREEM_PRODUCT_ID_YEARLY  — product id for the $60/yr AI Copilot (3-day trial)
//
// Nothing here throws at import time — the site renders fine before keys exist.

import { createHmac, timingSafeEqual } from "node:crypto";

export type CreemPlan = "monthly" | "yearly";

const MODE = process.env.CREEM_MODE === "live" ? "live" : "test";

export const creemConfig = {
  mode: MODE as "live" | "test",
  apiBase: MODE === "live" ? "https://api.creem.io/v1" : "https://test-api.creem.io/v1",
  apiKey: process.env.CREEM_API_KEY ?? "",
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET ?? "",
  productIds: {
    monthly: process.env.CREEM_PRODUCT_ID_MONTHLY ?? "",
    yearly: process.env.CREEM_PRODUCT_ID_YEARLY ?? "",
  },
} as const;

export function isCreemConfigured(): boolean {
  return Boolean(creemConfig.apiKey);
}

export function productIdFor(plan: CreemPlan): string {
  return creemConfig.productIds[plan];
}

async function creemFetch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${creemConfig.apiBase}${path}`, {
    method: "POST",
    headers: {
      "x-api-key": creemConfig.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as T & { message?: string } | null;
  if (!res.ok) {
    throw new Error(json?.message ?? `Creem request failed (${res.status})`);
  }
  return json as T;
}

/**
 * Create a hosted Creem checkout for the given plan.
 * Returns the URL the browser should be redirected to.
 */
export async function createCheckout(input: {
  plan: CreemPlan;
  successUrl: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
  requestId?: string;
}): Promise<{ checkoutUrl: string; checkoutId?: string }> {
  const productId = productIdFor(input.plan);
  if (!productId) throw new Error(`No Creem product id configured for "${input.plan}".`);

  const payload: Record<string, unknown> = {
    product_id: productId,
    success_url: input.successUrl,
    metadata: { plan: input.plan, ...input.metadata },
  };
  if (input.customerEmail) payload.customer = { email: input.customerEmail };
  if (input.requestId) payload.request_id = input.requestId;

  const data = await creemFetch<{ checkout_url: string; id?: string }>("/checkouts", payload);
  return { checkoutUrl: data.checkout_url, checkoutId: data.id };
}

/**
 * Create a Creem customer billing portal link so subscribers can update,
 * switch, or cancel their plan and download invoices.
 */
export async function createBillingPortal(customerId: string): Promise<string> {
  const data = await creemFetch<{ customer_portal_link: string }>("/customers/billing", {
    customer_id: customerId,
  });
  return data.customer_portal_link;
}

/**
 * Verify a webhook request came from Creem.
 * Signature is HMAC-SHA256 of the raw request body, hex-encoded, in the
 * `creem-signature` header.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature || !creemConfig.webhookSecret) return false;
  const expected = createHmac("sha256", creemConfig.webhookSecret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
