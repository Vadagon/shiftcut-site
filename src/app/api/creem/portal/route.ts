import { NextResponse } from "next/server";
import { createBillingPortal, isCreemConfigured } from "@/lib/creem";
import { getSubscription } from "@/lib/subscription";

export const runtime = "nodejs";

// Returns a Creem customer billing-portal link so a subscriber can update,
// switch monthly/yearly, cancel, or download invoices.
export async function POST(request: Request) {
  if (!isCreemConfigured()) {
    return NextResponse.json({ error: "Billing is not configured yet." }, { status: 503 });
  }

  let body: { email?: unknown; customerId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : undefined;
  let customerId = typeof body.customerId === "string" ? body.customerId : undefined;

  if (!customerId && email) {
    const record = await getSubscription({ email });
    customerId = record?.customerId || undefined;
  }
  if (!customerId) {
    return NextResponse.json({ error: "No subscription found for this account." }, { status: 404 });
  }

  try {
    const url = await createBillingPortal(customerId);
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not open billing portal.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
