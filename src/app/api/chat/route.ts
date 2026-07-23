import { NextResponse } from "next/server";
import { moderateInput } from "@/lib/moderation";

export const runtime = "nodejs";

type ProxyMessage = { role: "system" | "user" | "assistant"; content: string };

// Full-completion deadlines. A provider may start generating quickly while a
// large structured JSON response still needs significantly longer to finish.
const PLANNER_TIMEOUT_MS = 180_000;
const COMPONENT_TIMEOUT_MS = 180_000;
const MAX_MESSAGES = 48;
const MAX_TOTAL_CHARACTERS = 600_000;

function validMessages(value: unknown): value is ProxyMessage[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) return false;
  let characters = 0;
  for (const message of value) {
    if (!message || !["system", "user", "assistant"].includes(message.role) || typeof message.content !== "string") return false;
    characters += message.content.length;
    if (!message.content.trim() || characters > MAX_TOTAL_CHARACTERS) return false;
  }
  return value[0]?.role === "system";
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OpenRouter is not configured." }, { status: 503 });

  let body: { messages?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!validMessages(body.messages)) return NextResponse.json({ error: "A valid bounded model conversation is required." }, { status: 400 });
  const isPlannerPrompt = body.messages[0].content.startsWith("You are ShiftCut's editor planner")
    && body.messages[0].content.includes("<ShiftCutProject");
  const isComponentPrompt = body.messages[0].content.startsWith("You are editing one ShiftCut React visual")
    && body.messages[0].content.includes("\"type\": \"component_result\"");
  if (!isPlannerPrompt && !isComponentPrompt) {
    return NextResponse.json({ error: "Only ShiftCut composition requests are allowed." }, { status: 400 });
  }

  // Creem requires AI products to screen input through the Moderation API.
  const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
  if (lastUser) {
    const moderation = await moderateInput(lastUser.content);
    if (!moderation.allowed) {
      return NextResponse.json({ error: moderation.reason ?? "This request was blocked by content moderation." }, { status: 422 });
    }
  }

  const timeoutMs = isComponentPrompt ? COMPONENT_TIMEOUT_MS : PLANNER_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": request.headers.get("origin") ?? "http://localhost:3000",
        "X-Title": "ShiftCut",
        "X-OpenRouter-Metadata": "enabled",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash",
        messages: body.messages,
        response_format: { type: "json_object" },
        temperature: 0.25,
        max_completion_tokens: isComponentPrompt ? 8_192 : 16_384,
      }),
    });
    let responseText: string;
    try {
      responseText = await upstream.text();
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
        return NextResponse.json({ error: `The AI response timed out after ${timeoutMs / 1000} seconds.` }, { status: 504 });
      }
      return NextResponse.json({ error: "Could not read the OpenRouter response body." }, { status: 502 });
    }
    const result = (() => {
      try {
        return JSON.parse(responseText) as {
          id?: string;
          model?: string;
          choices?: Array<{
            finish_reason?: string | null;
            native_finish_reason?: string | null;
            message?: { content?: unknown; reasoning?: unknown };
          }>;
          usage?: Record<string, unknown>;
          error?: { message?: string; code?: unknown; metadata?: unknown };
          openrouter_metadata?: unknown;
        };
      } catch {
        return null;
      }
    })();
    if (!upstream.ok) {
      return NextResponse.json({
        error: result?.error?.message ?? "OpenRouter request failed.",
        upstream: diagnostic(result),
      }, { status: upstream.status });
    }
    const choice = result?.choices?.[0];
    const rawContent = choice?.message?.content;
    const content = typeof rawContent === "string"
      ? rawContent
      : Array.isArray(rawContent)
        ? rawContent.flatMap((part) => part && typeof part === "object" && "text" in part && typeof part.text === "string" ? [part.text] : []).join("")
        : "";
    if (!choice || !content.trim()) {
      return NextResponse.json({
        error: result?.error?.message
          ?? (!responseText.trim()
            ? "OpenRouter returned an empty response body."
            : !result
              ? "OpenRouter returned a non-JSON response body."
              : !choice
                ? "OpenRouter returned no completion choice."
                : "OpenRouter returned an empty completion."),
        upstream: diagnostic(result),
      }, { status: 502 });
    }
    return NextResponse.json({ content: content.trim(), upstream: diagnostic(result) });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return NextResponse.json({ error: timedOut ? `The AI response timed out after ${timeoutMs / 1000} seconds.` : "OpenRouter request failed." }, { status: timedOut ? 504 : 502 });
  } finally {
    clearTimeout(timeout);
  }
}

function diagnostic(result: {
  id?: string;
  model?: string;
  choices?: Array<{ finish_reason?: string | null; native_finish_reason?: string | null; message?: { reasoning?: unknown } }>;
  usage?: Record<string, unknown>;
  error?: { message?: string; code?: unknown; metadata?: unknown };
  openrouter_metadata?: unknown;
} | null) {
  const choice = result?.choices?.[0];
  return {
    requestId: result?.id ?? null,
    model: result?.model ?? process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash",
    finishReason: choice?.finish_reason ?? null,
    nativeFinishReason: choice?.native_finish_reason ?? null,
    hasReasoning: Boolean(choice?.message?.reasoning),
    usage: result?.usage ?? null,
    choiceCount: result?.choices?.length ?? 0,
    providerError: result?.error ?? null,
    routing: result?.openrouter_metadata ?? null,
  };
}
