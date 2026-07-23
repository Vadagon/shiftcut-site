// Creem Moderation API — mandatory for AI products under Creem's account-review
// guidelines. Every user prompt sent to the AI copilot is screened before it
// reaches the model. Fail-closed only when explicitly configured; by default,
// if moderation is unconfigured we allow (so local/dev works before keys land).
//
//   CREEM_MODERATION_API_KEY — key for the moderation endpoint (falls back to CREEM_API_KEY)
//   CREEM_MODERATION_ENABLED — "true" to enforce (block on flagged / on error)

import { creemConfig } from "./creem";

const ENABLED = process.env.CREEM_MODERATION_ENABLED === "true";
const KEY = process.env.CREEM_MODERATION_API_KEY ?? creemConfig.apiKey;

export type ModerationResult = { allowed: boolean; reason?: string };

/**
 * Screen user-supplied text through Creem's moderation endpoint.
 * - Not enabled → allowed (dev/local convenience).
 * - Enabled + flagged → blocked.
 * - Enabled + endpoint error → blocked (fail closed).
 */
export async function moderateInput(text: string): Promise<ModerationResult> {
  if (!ENABLED || !KEY) return { allowed: true };
  try {
    const res = await fetch(`${creemConfig.apiBase}/moderations`, {
      method: "POST",
      headers: { "x-api-key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ input: text }),
    });
    if (!res.ok) return { allowed: false, reason: "Moderation service unavailable." };
    const data = (await res.json().catch(() => null)) as { flagged?: boolean; categories?: string[] } | null;
    if (data?.flagged) {
      return { allowed: false, reason: "This request was blocked by content moderation." };
    }
    return { allowed: true };
  } catch {
    return { allowed: false, reason: "Moderation service unavailable." };
  }
}
