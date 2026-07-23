// Subscription state — the source of truth for whether a user's AI copilot is
// active. Creem webhooks write here; the AI chat proxy reads `aiActive()`.
//
// This is a minimal in-memory store so the gateway is fully wired end-to-end
// before a database is chosen. Swap `store` for a real persistent adapter
// (Postgres, KV, Redis) before going live — the interface is intentionally tiny.

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "expired";

export type SubscriptionRecord = {
  customerId: string;
  email: string | null;
  plan: "monthly" | "yearly" | null;
  status: SubscriptionStatus;
  currentPeriodEnd: number | null; // epoch ms
  updatedAt: number;
};

export interface SubscriptionStore {
  get(key: string): Promise<SubscriptionRecord | null>;
  set(key: string, record: SubscriptionRecord): Promise<void>;
}

// Default: in-memory (per server instance). NOT durable — replace before launch.
const memory = new Map<string, SubscriptionRecord>();
const store: SubscriptionStore = {
  async get(key) {
    return memory.get(key) ?? null;
  },
  async set(key, record) {
    memory.set(key, record);
  },
};

// We key by email when available (that's what checkout collects), falling back
// to the Creem customer id.
export function subscriptionKey(input: { email?: string | null; customerId?: string | null }): string | null {
  if (input.email) return `email:${input.email.toLowerCase()}`;
  if (input.customerId) return `cus:${input.customerId}`;
  return null;
}

export async function upsertSubscription(record: SubscriptionRecord): Promise<void> {
  const keys = [
    subscriptionKey({ email: record.email }),
    subscriptionKey({ customerId: record.customerId }),
  ].filter(Boolean) as string[];
  for (const key of keys) await store.set(key, record);
}

export async function getSubscription(input: { email?: string | null; customerId?: string | null }): Promise<SubscriptionRecord | null> {
  const key = subscriptionKey(input);
  if (!key) return null;
  return store.get(key);
}

const ACTIVE: SubscriptionStatus[] = ["trialing", "active"];

/** Is the AI copilot currently usable for this identity? */
export async function aiActive(input: { email?: string | null; customerId?: string | null }): Promise<boolean> {
  const record = await getSubscription(input);
  if (!record) return false;
  if (!ACTIVE.includes(record.status)) return false;
  if (record.currentPeriodEnd && record.currentPeriodEnd < Date.now()) return false;
  return true;
}
