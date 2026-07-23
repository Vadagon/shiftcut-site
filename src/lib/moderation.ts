// Creem Content Moderation — MANDATORY for AI generation platforms under Creem's
// account-review / content-safety requirements. Every user prompt that can drive
// generation or editing is screened BEFORE it reaches the model.
//
// Endpoint: POST {apiBase}/moderation/prompt  { prompt, external_id? }
//   → { decision: "allow" | "flag" | "deny", ... }
//   allow = proceed · flag = closely monitored (we block) · deny = block.
//
// Enforcement: whenever a Creem key is configured, screening is ON and fails
// CLOSED (a moderation outage blocks rather than leaks). Set
// CREEM_MODERATION_DISABLED=true ONLY for local development without a key.
//
//   CREEM_MODERATION_API_KEY — optional; falls back to CREEM_API_KEY.
//   CREEM_MODERATION_DISABLED — "true" disables screening (dev only).

import { creemConfig } from "./creem";

const KEY = process.env.CREEM_MODERATION_API_KEY ?? creemConfig.apiKey;
const DISABLED = process.env.CREEM_MODERATION_DISABLED === "true";

export type ModerationResult = { allowed: boolean; reason?: string; decision?: string };

const BLOCK_MESSAGE = "This request was blocked by content moderation and cannot be processed.";

/** Screen a single prompt through Creem's moderation endpoint. Fails closed. */
export async function moderatePrompt(prompt: string, externalId?: string): Promise<ModerationResult> {
  if (DISABLED || !KEY) return { allowed: true };
  const text = prompt.trim();
  if (!text) return { allowed: true };

  try {
    const res = await fetch(`${creemConfig.apiBase}/moderation/prompt`, {
      method: "POST",
      headers: { "x-api-key": KEY, "content-type": "application/json" },
      body: JSON.stringify({ prompt: text.slice(0, 8_000), ...(externalId ? { external_id: externalId } : {}) }),
    });
    if (!res.ok) return { allowed: false, reason: "Content moderation is temporarily unavailable. Please try again." };
    const data = (await res.json().catch(() => null)) as { decision?: string } | null;
    const decision = data?.decision;
    // Block on anything that isn't an explicit allow (deny, flag, or unknown).
    if (decision !== "allow") {
      return { allowed: false, reason: BLOCK_MESSAGE, decision };
    }
    return { allowed: true, decision };
  } catch {
    return { allowed: false, reason: "Content moderation is temporarily unavailable. Please try again." };
  }
}

/** Screen the most recent user message in a conversation. */
export async function moderateLatestUserMessage(
  messages: Array<{ role: string; content: string }>,
  externalId?: string,
): Promise<ModerationResult> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return { allowed: true };
  return moderatePrompt(lastUser.content, externalId);
}
