import { NextResponse } from "next/server";
import { createCheckout, isCreemConfigured, type CreemPlan } from "@/lib/creem";

export const runtime = "nodejs";

const PLANS: CreemPlan[] = ["monthly", "yearly"];

export async function POST(request: Request) {
  if (!isCreemConfigured()) {
    return NextResponse.json({ error: "Billing is not configured yet." }, { status: 503 });
  }

  let body: { plan?: unknown; email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const plan = body.plan;
  if (typeof plan !== "string" || !PLANS.includes(plan as CreemPlan)) {
    return NextResponse.json({ error: "A valid plan (monthly | yearly) is required." }, { status: 400 });
  }
  const email = typeof body.email === "string" && body.email.includes("@") ? body.email : undefined;

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

  try {
    const { checkoutUrl } = await createCheckout({
      plan: plan as CreemPlan,
      successUrl: `${origin}/billing/success`,
      customerEmail: email,
    });
    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start checkout.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
