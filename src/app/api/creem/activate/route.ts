import { NextResponse } from "next/server";
import { aiActive } from "@/lib/subscription";
import { createSubscriberSession, SUBSCRIBER_COOKIE, verifyCreemRedirect } from "@/lib/subscriber-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { query?: unknown } | null;
  if (typeof body?.query !== "string") return NextResponse.json({ error: "Missing checkout result." }, { status: 400 });
  const params = new URLSearchParams(body.query);
  if (!verifyCreemRedirect(params)) return NextResponse.json({ error: "Invalid checkout signature." }, { status: 401 });
  const customerId = params.get("customer_id");
  if (!customerId || !(await aiActive({ customerId }))) {
    return NextResponse.json({ error: "Subscription is not active yet." }, { status: 409 });
  }
  const response = NextResponse.json({ active: true });
  response.cookies.set(SUBSCRIBER_COOKIE, createSubscriberSession(customerId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
