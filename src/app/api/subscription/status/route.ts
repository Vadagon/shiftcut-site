import { NextResponse } from "next/server";
import { requestHasActiveSubscription } from "@/lib/subscriber-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return NextResponse.json({ active: await requestHasActiveSubscription(request) }, {
    headers: { "Cache-Control": "no-store" },
  });
}
