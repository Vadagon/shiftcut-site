import { NextResponse } from "next/server";
import { moderateLatestUserMessage } from "@/lib/moderation";
import { requestHasActiveSubscription } from "@/lib/subscriber-session";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };
const OPENROUTER_TIMEOUT_MS = 30_000;

function validMessages(value: unknown): value is ChatMessage[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 80 && value.every((message) =>
    message && (message.role === "user" || message.role === "assistant") && typeof message.content === "string" && message.content.length <= 12_000,
  );
}

export async function POST(request: Request) {
  if (!(await requestHasActiveSubscription(request))) {
    return NextResponse.json({ error: "An active ShiftCut AI subscription is required." }, { status: 402 });
  }
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OpenRouter is not configured." }, { status: 503 });
  const body = await request.json().catch(() => null) as { previousSummary?: unknown; messages?: unknown } | null;
  if (!body || !validMessages(body.messages)) return NextResponse.json({ error: "A valid conversation segment is required." }, { status: 400 });

  // Screen user-supplied content through Creem moderation before processing.
  const moderation = await moderateLatestUserMessage(body.messages);
  if (!moderation.allowed) {
    return NextResponse.json({ error: moderation.reason ?? "This request was blocked by content moderation." }, { status: 422 });
  }

  const previousSummary = typeof body.previousSummary === "string" ? body.previousSummary.slice(0, 8_000) : "";
  const source = body.messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join("\n\n");
  const prompt = `Create compact, factual working memory for a video-editing AI assistant. Return ONLY JSON: {"summary":"..."}.\n\nPreserve user goals, visual preferences, decisions, corrections, unresolved requests, and failed approaches worth avoiding. Do NOT repeat timeline state, revision numbers, assets, component code, settings, or debug payloads: those are supplied separately on every request.\n\nExisting memory:\n${previousSummary || "(none)"}\n\nConversation segment to absorb:\n${source}`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST", signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": request.headers.get("origin") ?? "http://localhost:3000", "X-Title": "ShiftCut" },
        body: JSON.stringify({ model: process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash", messages: [{ role: "system", content: "You summarize internal assistant memory. Follow the requested JSON response format exactly." }, { role: "user", content: prompt }], temperature: 0.1 }),
      });
    } catch {
      clearTimeout(timeout);
      continue;
    }
    clearTimeout(timeout);
    const data = await response.json().catch(() => null) as { choices?: Array<{ message?: { content?: unknown } }> } | null;
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") continue;
    try {
      const parsed = JSON.parse(content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()) as { summary?: unknown };
      if (typeof parsed.summary === "string" && parsed.summary.trim() && parsed.summary.length <= 8_000) return NextResponse.json({ summary: parsed.summary.trim() });
    } catch {
      // Retry a malformed compaction response without exposing it to the editor.
    }
  }
  console.error("[shiftcut:chat-compaction-failed]", { messageCount: body.messages.length });
  return NextResponse.json({ error: "Could not compact AI conversation memory." }, { status: 502 });
}
