import { createHmac, timingSafeEqual } from "node:crypto";
import { creemConfig } from "@/lib/creem";
import { aiActive } from "@/lib/subscription";

export const SUBSCRIBER_COOKIE = "shiftcut_ai_subscriber";

function secret() {
  return process.env.SUBSCRIBER_SESSION_SECRET || creemConfig.apiKey;
}

function signature(value: string) {
  const key = secret();
  return key ? createHmac("sha256", key).update(value).digest("hex") : "";
}

export function createSubscriberSession(customerId: string) {
  return `${encodeURIComponent(customerId)}.${signature(customerId)}`;
}

export function readSubscriberCustomerId(request: Request) {
  const raw = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SUBSCRIBER_COOKIE}=`))?.slice(SUBSCRIBER_COOKIE.length + 1);
  if (!raw) return null;
  const separator = raw.lastIndexOf(".");
  if (separator < 1) return null;
  const customerId = decodeURIComponent(raw.slice(0, separator));
  const supplied = raw.slice(separator + 1);
  const expected = signature(customerId);
  if (!expected || supplied.length !== expected.length) return null;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)) ? customerId : null;
}

export async function requestHasActiveSubscription(request: Request) {
  const customerId = readSubscriberCustomerId(request);
  return customerId ? aiActive({ customerId }) : false;
}

export function verifyCreemRedirect(params: URLSearchParams) {
  if (!creemConfig.apiKey) return false;
  const supplied = params.get("signature");
  if (!supplied) return false;
  const payload = [...params.entries()]
    .filter(([key, value]) => key !== "signature" && value && value !== "null")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const expected = createHmac("sha256", creemConfig.apiKey).update(payload).digest("hex");
  return supplied.length === expected.length && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}
