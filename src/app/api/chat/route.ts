import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ProjectContext = {
  name?: unknown;
  revision?: unknown;
  settings?: unknown;
  selectedElementId?: unknown;
  suggestedElementId?: unknown;
  timeline?: unknown;
  components?: unknown;
  assets?: unknown;
};

function validMessages(value: unknown): value is ChatMessage[] {
  return Array.isArray(value) && value.length <= 40 && value.every((message) =>
    message &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    message.content.length <= 12_000,
  );
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OpenRouter is not configured." }, { status: 503 });

  let body: { messages?: unknown; project?: ProjectContext };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!validMessages(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "A valid conversation is required." }, { status: 400 });
  }

  const projectName = typeof body.project?.name === "string" ? body.project.name.slice(0, 160) : "Untitled project";
  const revision = typeof body.project?.revision === "number" && Number.isFinite(body.project.revision) ? body.project.revision : null;
  const revisionContext = revision === null ? "No project revision is available." : `The client reports project revision ${revision}.`;
  const settings = JSON.stringify(body.project?.settings ?? {}).slice(0, 1_000);
  const timeline = JSON.stringify(body.project?.timeline ?? []).slice(0, 24_000);
  const components = JSON.stringify(body.project?.components ?? []).slice(0, 48_000);
  const assets = JSON.stringify(body.project?.assets ?? []).slice(0, 8_000);
  const latestUserMessage = [...body.messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const animationRequested = /\b(?:animate|animation|explode|explosion|burst|particle|motion|bounce|slide|zoom|transition)\b/i.test(latestUserMessage);
  const selectedElementId = typeof body.project?.selectedElementId === "string" ? body.project.selectedElementId : null;
  const suggestedElementId = typeof body.project?.suggestedElementId === "string" ? body.project.suggestedElementId : null;

  const systemPrompt = `You are ShiftCut's video-editing assistant. The active project is "${projectName}". ${revisionContext}

Return ONLY a JSON object with this shape:
{"reply":"short user-facing response","expectedRevision":number|null,"operations":[]}

This built-in chat receives a fresh project snapshot on every request. For every edit operation, expectedRevision must equal ${revision ?? "null"}. The editor applies operations only when that revision still matches at response time. Operations may use ONLY these actions:
1. {"action":"add_component","trackId":"optional free track id","name":"timeline element name","startTime":number,"duration":number,"params":{"text":"...","x":0,"y":0,"scale":1,"rotation":0,"opacity":1,"zIndex":1,"color":"#ffffff","fontSize":48},"component":{"name":"SummerSaleExplosion","description":"A title that bursts into deterministic particles at local second three.","code":"plain JavaScript React component source","propsSchema":[{"name":"text","type":"string","default":"..."}]}}
2. {"action":"update_params","elementId":"existing element id","params":{"x":number,"y":number,"scale":number,"rotation":number,"opacity":number,"text":"...","color":"#...","fontSize":number,"volume":number}}
3. {"action":"move_element","elementId":"existing element id","trackId":"optional target track id","startTime":number}
4. {"action":"remove_element","elementId":"existing element id"}
5. {"action":"add_media","trackId":"existing track id","mediaId":"available asset id","startTime":number}
6. {"action":"update_component","elementId":"existing generated component element id","component":{"name":"ComponentName","description":"What this component visually does.","code":"replacement React source","propsSchema":[]}}
7. {"action":"replace_timeline","tracks":[{"name":"V2","type":"media","elements":[{"name":"Overlay","startTime":0,"duration":3,"params":{},"generatedComponent":{"name":"ComponentName","description":"...","code":"GeneratedComponent source","propsSchema":[]}}, {"name":"Clip","mediaId":"available asset id","startTime":3,"duration":5,"params":{}}]}]}

For add_component and update_component, code must define function GeneratedComponent(props), use React.createElement only (no JSX, imports, fetch, timers, localStorage, window, document, or external URLs), and render the requested overlay. The code is stored as a React component and runs only in a sandboxed preview iframe. Props include localTime (seconds since the clip began), duration, canvasWidth, canvasHeight, x, y, scale, rotation, opacity, color, fontSize, and text. The iframe fills the full canvas: generated code MUST apply x/y/scale/rotation/opacity itself and must not assume an outer transform. For complex animation, derive every visual state deterministically from localTime. For example, a burst at local second 3 should calculate a bounded progress from localTime - 3 and use a fixed Array.from particle sequence, transforms, opacity, and color. A radial particle burst must distribute its full circle with angle = (i / particleCount) * Math.PI * 2. Never use CSS animation, CSS transitions, requestAnimationFrame, timers, Date, performance, or Math.random. Do not claim edits are complete; say which operations are proposed/applied by the editor.

This request requires an animation: ${animationRequested}. When true, return an add_component or update_component operation (not merely update_params), and its code MUST use props.localTime to calculate the requested motion. A static text component is invalid. A user should never need to mention implementation details such as localTime, particles, or timing props.

For a vague request such as "make it epic", "make it explode", or "make an epic explode", preserve the existing text and make a polished impact-burst by default: briefly hold the readable title, add a short anticipation, then release a full-circle red/orange particle burst plus one shockwave, and fade it cleanly. Choose the impact at local second 3 when the clip is long enough; otherwise choose the clip midpoint. Use a fixed particle sequence (not random values), use props.localTime throughout, and update the existing generated component rather than adding duplicate text. This is a visual default, not something the user must ask for technically.

Selected timeline element: ${selectedElementId ?? "none"}. Suggested generated-component target when nothing is selected: ${suggestedElementId ?? "none"}. For requests to regenerate or modify an existing component, use update_component for the selected element. If no element is selected, use the suggested target when present. If both are none and the request does not identify a target, ask one short clarification instead of editing an arbitrary timeline item.

For a restructuring request, use exactly one replace_timeline operation. Rebuild the complete ordered track list from the current project, omit every unneeded empty track, preserve all clips/assets/components unless the user asks to remove them, and do not overlap elements on the same track. This is an explicit AI-authorized mutation; project loading or ordinary UI rendering must never perform this cleanup.

When the user explicitly asks to completely replace, rebuild, or start over with the timeline, use exactly one replace_timeline operation. It atomically replaces every track. Tracks may only be type "media" (the unified visual/motion stack) or "audio". Within each replacement track, elements must be ordered and cannot overlap. Generated overlays go in a media track and use generatedComponent; videos/images/audio must reference an available mediaId. A replacement is one undoable project revision.

Revisions are immutable history. You always edit the supplied current revision only; never attempt to alter a past revision. Every accepted operation—including a complete replacement—becomes a new revision. If the user has used Undo, trust the supplied revision number, timeline, settings, and component registry as the complete current truth, even if prior conversation messages describe a different timeline.

Canvas settings: ${settings}. Use x, y, and fontSize in canonical output pixels relative to this canvas resolution; use scale as a unitless multiplier. Do not use em, rem, or percentage values for timeline element params.

Timeline context: ${timeline}
Component registry (source code is separate from the compact timeline): ${components}
Available assets: ${assets}`;

  const callModel = async (messages: ChatMessage[]) => {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": request.headers.get("origin") ?? "http://localhost:3000",
        "X-Title": "ShiftCut",
      },
      body: JSON.stringify({ model: process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash", messages: [{ role: "system", content: systemPrompt }, ...messages], temperature: 0.4 }),
    });
    const result = await upstream.json().catch(() => null) as { choices?: Array<{ message?: { content?: unknown } }>; error?: { message?: string } } | null;
    const content = result?.choices?.[0]?.message?.content;
    return { status: upstream.status, error: upstream.ok ? null : result?.error?.message ?? "OpenRouter request failed.", content: typeof content === "string" ? content : null };
  };

  let modelReply = await callModel(body.messages);
  if (modelReply.error) return NextResponse.json({ error: modelReply.error }, { status: modelReply.status });
  if (!modelReply.content?.trim()) return NextResponse.json({ error: "The model returned an empty response." }, { status: 502 });
  let parsed = parseResponse(modelReply.content);

  // A motion request must become actual time-driven component code. If the
  // first pass returns a static or malformed operation, repair it internally
  // instead of asking the user to understand renderer implementation details.
  if (animationRequested && !hasTimeDrivenComponent(parsed)) {
    modelReply = await callModel([
      ...body.messages,
      { role: "assistant", content: modelReply.content },
      { role: "user", content: "Internal correction: return a valid update_component or add_component now. Its GeneratedComponent source must visibly use props.localTime for the requested animation. Return JSON only." },
    ]);
    if (modelReply.error) return NextResponse.json({ error: modelReply.error }, { status: modelReply.status });
    parsed = modelReply.content ? parseResponse(modelReply.content) : null;
  }
  if (animationRequested && !hasTimeDrivenComponent(parsed)) {
    return NextResponse.json({ reply: "I couldn’t generate that animation yet. Please try the same visual request again.", expectedRevision: revision, operations: [] });
  }
  return NextResponse.json(parsed ?? { content: modelReply.content, reply: modelReply.content, expectedRevision: null, operations: [] });
}

function hasTimeDrivenComponent(response: Record<string, unknown> | null) {
  if (!response || !Array.isArray(response.operations)) return false;
  return response.operations.some((operation) => {
    if (!operation || typeof operation !== "object") return false;
    const record = operation as Record<string, unknown>;
    if (record.action === "replace_timeline" && Array.isArray(record.tracks)) {
      const replacementTracks = record.tracks as unknown[];
      return replacementTracks.some((track) => {
        const elements = track && typeof track === "object" && Array.isArray((track as Record<string, unknown>).elements) ? (track as Record<string, unknown>).elements as unknown[] : [];
        return elements.some((element: unknown) => {
        const generated = element && typeof element === "object" ? (element as Record<string, unknown>).generatedComponent : null;
        return generated && typeof generated === "object" && typeof (generated as Record<string, unknown>).code === "string" && /props\.localTime\b/.test((generated as Record<string, unknown>).code as string);
        });
      });
    }
    if (record.action !== "add_component" && record.action !== "update_component") return false;
    const component = record.component;
    return component && typeof component === "object" && typeof (component as Record<string, unknown>).code === "string" && /props\.localTime\b/.test((component as Record<string, unknown>).code as string);
  });
}

function parseResponse(content: string): Record<string, unknown> | null {
  const candidate = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const parsed = JSON.parse(candidate);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const result = parsed as Record<string, unknown>;
    if (typeof result.reply !== "string" || !Array.isArray(result.operations)) return null;
    return {
      reply: result.reply,
      expectedRevision: typeof result.expectedRevision === "number" ? result.expectedRevision : null,
      operations: result.operations.filter((operation) => operation && typeof operation === "object").slice(0, 12),
    };
  } catch {
    return null;
  }
}
