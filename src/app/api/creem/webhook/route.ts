import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/creem";
import { upsertSubscription, type SubscriptionStatus } from "@/lib/subscription";

export const runtime = "nodejs";

// Map Creem subscription statuses / event types onto our internal status.
function statusFromEvent(eventType: string, subStatus?: string): SubscriptionStatus | null {
  if (subStatus) {
    switch (subStatus) {
      case "trialing":
        return "trialing";
      case "active":
        return "active";
      case "past_due":
      case "unpaid":
        return "past_due";
      case "canceled":
        return "canceled";
      case "expired":
      case "paused":
        return "expired";
    }
  }
  switch (eventType) {
    case "subscription.trialing":
      return "trialing";
    case "subscription.active":
    case "subscription.paid":
      return "active";
    case "subscription.past_due":
      return "past_due";
    case "subscription.canceled":
      return "canceled";
    case "subscription.expired":
    case "refund.created":
      return "expired";
    default:
      return null;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("creem-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event: {
    eventType?: string;
    type?: string;
    object?: Record<string, unknown>;
    data?: Record<string, unknown>;
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const eventType = event.eventType ?? event.type ?? "";
  const object = (event.object ?? event.data ?? {}) as Record<string, unknown>;

  const subStatus = typeof object.status === "string" ? object.status : undefined;
  const status = statusFromEvent(eventType, subStatus);
  if (!status) {
    // Not a subscription-lifecycle event we track — acknowledge and move on.
    return NextResponse.json({ received: true });
  }

  const customer = (object.customer ?? {}) as Record<string, unknown>;
  const customerId =
    (typeof object.customer_id === "string" && object.customer_id) ||
    (typeof customer.id === "string" && customer.id) ||
    "";
  const email =
    (typeof customer.email === "string" && customer.email) ||
    (typeof object.customer_email === "string" && object.customer_email) ||
    null;

  const metadata = (object.metadata ?? {}) as Record<string, unknown>;
  const plan = metadata.plan === "yearly" ? "yearly" : metadata.plan === "monthly" ? "monthly" : null;

  const periodEndRaw = object.current_period_end_date ?? object.current_period_end;
  const currentPeriodEnd =
    typeof periodEndRaw === "string" ? Date.parse(periodEndRaw) || null :
    typeof periodEndRaw === "number" ? periodEndRaw : null;

  if (!customerId && !email) {
    return NextResponse.json({ received: true });
  }

  await upsertSubscription({
    customerId,
    email,
    plan,
    status,
    currentPeriodEnd,
    updatedAt: Date.now(),
  });

  return NextResponse.json({ received: true });
}
