import { validateGeneratedComponentSource } from "@/lib/generated-component-contract";
import { uid } from "@/lib/utils";
import { canPlaceElementOnTrack, elementEnd, type ElementParams, type TimelineElement, type TimelineTrack, type TrackType } from "@/types/timeline";
import type { ComponentArtifact, MediaFileData } from "@/lib/storage/types";

export const SHIFT_CUT_TRANSACTION_PROTOCOL = "shiftcut-ai-transaction/v1";

type JsonRecord = Record<string, unknown>;

export type EditorOperation =
  | { type: "create_track"; temporaryId: string; trackType: "visual" | "audio"; name?: string; position?: number }
  | { type: "delete_track"; trackId: string }
  | { type: "delete_element"; elementId: string }
  | { type: "move_element"; elementId: string; trackId: string; startTime: number }
  | { type: "update_element"; elementId: string; patch: { name?: string; startTime?: number; duration?: number; trimStart?: number; trimEnd?: number; params?: JsonRecord } }
  | { type: "add_media"; mediaId: string; trackId: string; startTime: number; duration?: number }
  | { type: "edit_component"; elementId: string; instruction: string }
  | { type: "create_component"; temporaryElementId: string; trackId: string; name: string; startTime: number; duration: number; params?: JsonRecord; instruction: string };

export type EditorTransaction =
  | { type: "no_changes"; expectedRevision: number; reply: string; operations: [] }
  | { type: "editor_transaction"; expectedRevision: number; summary: string; reply: string; operations: EditorOperation[] };

export type ComponentJob = {
  kind: "edit" | "create";
  elementId: string;
  instruction: string;
  trackId?: string;
  name?: string;
  startTime?: number;
  duration?: number;
  params?: JsonRecord;
};

export type ComponentResult = {
  type: "component_result";
  expectedRevision: number;
  elementId: string;
  name: string;
  description: string;
  propsSchema: Array<{ name: string; type: "string" | "number" | "boolean" | "color"; default?: unknown }>;
  code: string;
  reply: string;
};

export function buildTransactionPrompt(input: {
  projectName: string;
  revision: number;
  compactProject: string;
  memory: string;
  selectedElementId: string | null;
  suggestedElementId: string | null;
}) {
  return `You are ShiftCut's editor planner. Return one JSON object only; never return JSX or Markdown.

The editor owns IDs, component versions, validation, and commits. You only describe intended changes.

Response:
{
  "type": "editor_transaction",
  "expectedRevision": ${input.revision},
  "summary": "short revision summary",
  "reply": "short user-facing result",
  "operations": [...]
}

Allowed operations:
- {"type":"create_track","temporaryId":"new:overlay","trackType":"visual|audio","name":"Overlay","position":0}
- {"type":"delete_track","trackId":"existing-track-id"}
- {"type":"delete_element","elementId":"existing-element-id"}
- {"type":"move_element","elementId":"existing-element-id","trackId":"existing-or-temporary-track-id","startTime":2}
- {"type":"update_element","elementId":"existing-element-id","patch":{"name":"Title","startTime":0,"duration":5,"trimStart":0,"trimEnd":0,"params":{"text":"New","x":540}}}
- {"type":"add_media","mediaId":"existing-media-id","trackId":"existing-or-temporary-track-id","startTime":0,"duration":5}
- {"type":"edit_component","elementId":"existing-component-element-id","instruction":"precise visual/code change"}
- {"type":"create_component","temporaryElementId":"new:title","trackId":"existing-or-temporary-track-id","name":"Title","startTime":0,"duration":5,"params":{"text":"Sale","x":540,"y":960},"instruction":"precise visual/code request"}

For questions or ambiguity:
{"type":"no_changes","expectedRevision":${input.revision},"reply":"question","operations":[]}

Rules:
- A request may contain many operations. Put all of them in one transaction.
- Use update_element/move_element for timing, duration, trims, placement, text, transform, color, and volume.
- Use edit_component only for rendering structure or animation code.
- Use create_component only when the user explicitly asks to add a new visual.
- For a broad restructure, use create/delete/move/update operations together. Delete empty/unneeded tracks only when requested.
- Never echo componentId, componentVersion, project settings, or component source.
- Never overlap elements in one track.
- Preserve unrelated data.
- Selected element: ${input.selectedElementId ?? "none"}.
- Suggested component element: ${input.suggestedElementId ?? "none"}.
- Current revision: ${input.revision}.

Conversation memory:
${input.memory || "(none)"}

Current project:
${input.compactProject}`;
}

export function parseEditorTransaction(source: string, expectedRevision: number): EditorTransaction {
  const value = parseJsonObject(source);
  const type = value.type;
  if (value.expectedRevision !== expectedRevision) throw new Error(`expectedRevision must be ${expectedRevision}.`);
  if (type === "no_changes") {
    if (!Array.isArray(value.operations) || value.operations.length !== 0) throw new Error("no_changes operations must be empty.");
    return { type, expectedRevision, reply: requiredString(value.reply, "reply"), operations: [] };
  }
  if (type !== "editor_transaction") throw new Error("type must be editor_transaction or no_changes.");
  if (!Array.isArray(value.operations) || value.operations.length < 1 || value.operations.length > 40) throw new Error("editor_transaction requires 1-40 operations.");
  return {
    type,
    expectedRevision,
    summary: requiredString(value.summary, "summary"),
    reply: requiredString(value.reply, "reply"),
    operations: value.operations.map((operation, index) => parseOperation(operation, index)),
  };
}

export function simulateTransaction(input: {
  transaction: Extract<EditorTransaction, { type: "editor_transaction" }>;
  tracks: TimelineTrack[];
  assets: MediaFileData[];
  fps: number;
}) {
  const tracks = structuredClone(input.tracks);
  const jobs: ComponentJob[] = [];
  const trackAliases = new Map<string, string>();
  const frame = (value: number) => Math.round(value * input.fps) / input.fps;
  const resolveTrack = (id: string) => trackAliases.get(id) ?? id;
  const find = (elementId: string) => {
    for (const track of tracks) {
      const index = track.elements.findIndex((element) => element.id === elementId);
      if (index >= 0) return { track, index, element: track.elements[index] };
    }
    return null;
  };

  for (const operation of input.transaction.operations) {
    if (operation.type === "create_track") {
      if (trackAliases.has(operation.temporaryId) || tracks.some((track) => track.id === operation.temporaryId)) throw new Error(`Duplicate temporary track ID ${operation.temporaryId}.`);
      const id = uid("track");
      trackAliases.set(operation.temporaryId, id);
      const type: TrackType = operation.trackType === "audio" ? "audio" : "media";
      const track: TimelineTrack = { id, name: operation.name?.trim() || (type === "audio" ? "Audio" : "Video"), type, elements: [], muted: false, hidden: false, locked: false };
      const position = Math.max(0, Math.min(tracks.length, Math.round(operation.position ?? (type === "audio" ? tracks.length : 0))));
      tracks.splice(position, 0, track);
      continue;
    }
    if (operation.type === "delete_track") {
      const id = resolveTrack(operation.trackId);
      const index = tracks.findIndex((track) => track.id === id);
      if (index < 0) throw new Error(`Unknown track ${operation.trackId}.`);
      if (tracks[index].elements.length) throw new Error(`Track ${operation.trackId} is not empty; move or delete its elements first.`);
      tracks.splice(index, 1);
      continue;
    }
    if (operation.type === "delete_element") {
      const found = find(operation.elementId);
      if (!found) throw new Error(`Unknown element ${operation.elementId}.`);
      found.track.elements.splice(found.index, 1);
      continue;
    }
    if (operation.type === "move_element") {
      const found = find(operation.elementId);
      const destination = tracks.find((track) => track.id === resolveTrack(operation.trackId));
      if (!found) throw new Error(`Unknown element ${operation.elementId}.`);
      if (!destination) throw new Error(`Unknown track ${operation.trackId}.`);
      if (!canPlaceElementOnTrack(found.element, destination)) throw new Error(`Element ${operation.elementId} is incompatible with track ${operation.trackId}.`);
      found.track.elements.splice(found.index, 1);
      destination.elements.push({ ...found.element, startTime: frame(nonNegative(operation.startTime)) });
      continue;
    }
    if (operation.type === "update_element") {
      const found = find(operation.elementId);
      if (!found) throw new Error(`Unknown element ${operation.elementId}.`);
      const patch = operation.patch;
      found.track.elements[found.index] = {
        ...found.element,
        ...(patch.name ? { name: patch.name } : {}),
        ...(patch.startTime !== undefined ? { startTime: frame(nonNegative(patch.startTime)) } : {}),
        ...(patch.duration !== undefined ? { duration: framePositive(patch.duration, input.fps) } : {}),
        ...(patch.trimStart !== undefined ? { trimStart: frame(nonNegative(patch.trimStart)) } : {}),
        ...(patch.trimEnd !== undefined ? { trimEnd: frame(nonNegative(patch.trimEnd)) } : {}),
        ...(patch.params ? { params: { ...found.element.params, ...cleanParams(patch.params) } } : {}),
      };
      continue;
    }
    if (operation.type === "add_media") {
      const asset = input.assets.find((item) => item.id === operation.mediaId);
      const track = tracks.find((item) => item.id === resolveTrack(operation.trackId));
      if (!asset) throw new Error(`Unknown media ${operation.mediaId}.`);
      if (!track) throw new Error(`Unknown track ${operation.trackId}.`);
      const component = asset.kind === "audio" ? "AudioPlayer" : asset.kind === "video" ? "VideoPlayer" : "ImagePlayer";
      const element: TimelineElement = {
        id: uid("el"), type: "media", mediaId: asset.id, name: asset.name, component,
        startTime: frame(nonNegative(operation.startTime)),
        duration: framePositive(operation.duration ?? asset.duration ?? 5, input.fps),
        trimStart: 0, trimEnd: 0, params: defaults(),
      };
      if (!canPlaceElementOnTrack(element, track)) throw new Error(`Media ${operation.mediaId} is incompatible with track ${operation.trackId}.`);
      track.elements.push(element);
      continue;
    }
    if (operation.type === "edit_component") {
      const found = find(operation.elementId);
      if (!found?.element.componentId) throw new Error(`Element ${operation.elementId} is not an AI component.`);
      jobs.push({ kind: "edit", elementId: operation.elementId, instruction: operation.instruction });
      continue;
    }
    const trackId = resolveTrack(operation.trackId);
    const track = tracks.find((item) => item.id === trackId);
    if (!track || track.type !== "media") throw new Error(`New component requires a visual track: ${operation.trackId}.`);
    const elementId = uid("el");
    jobs.push({
      kind: "create", elementId, instruction: operation.instruction, trackId,
      name: operation.name, startTime: frame(nonNegative(operation.startTime)),
      duration: framePositive(operation.duration, input.fps), params: cleanParams(operation.params ?? {}),
    });
    track.elements.push({
      id: elementId,
      type: "text",
      name: operation.name,
      component: "GeneratedReactComponent",
      startTime: frame(nonNegative(operation.startTime)),
      duration: framePositive(operation.duration, input.fps),
      trimStart: 0,
      trimEnd: 0,
      params: { ...defaults(), ...cleanParams(operation.params ?? {}) },
    });
  }
  validateTimeline(tracks);
  return { tracks, componentJobs: jobs };
}

export function buildFocusedComponentPrompt(input: {
  revision: number;
  job: ComponentJob;
  artifact?: ComponentArtifact;
  element?: TimelineElement;
  projectWidth: number;
  projectHeight: number;
  fps: number;
}) {
  return `You are editing one ShiftCut React visual. Return one JSON object only, without Markdown.

{
  "type": "component_result",
  "expectedRevision": ${input.revision},
  "elementId": ${JSON.stringify(input.job.elementId)},
  "name": "Readable name",
  "description": "What it renders and how it moves",
  "propsSchema": [{"name":"text","type":"string","default":"Title"}],
  "code": "function GeneratedComponent(props) { ... }",
  "reply": "Short user-facing summary"
}

Instruction: ${input.job.instruction}
Canvas: ${input.projectWidth}x${input.projectHeight} at ${input.fps}fps.
Element params: ${JSON.stringify(input.element?.params ?? input.job.params ?? {})}
Current component: ${input.artifact ? JSON.stringify({ name: input.artifact.name, description: input.artifact.description, propsSchema: input.artifact.propsSchema, code: input.artifact.code }) : "(new component)"}

Rules:
- Define function GeneratedComponent(props).
- Use React.createElement only; no JSX or imports.
- Motion must derive from props.localTime and be deterministic.
- No timers, Date, performance, Math.random, fetch, storage, browser/process globals, CSS animations, or transitions.
- Return complete replacement source, not a patch.`;
}

export function parseComponentResult(source: string, input: { expectedRevision: number; elementId: string; requireAnimation: boolean }): ComponentResult {
  const value = parseJsonObject(source);
  if (value.type !== "component_result") throw new Error("type must be component_result.");
  if (value.expectedRevision !== input.expectedRevision) throw new Error(`expectedRevision must be ${input.expectedRevision}.`);
  if (value.elementId !== input.elementId) throw new Error(`elementId must be ${input.elementId}.`);
  const code = requiredString(value.code, "code");
  const safety = validateGeneratedComponentSource(code);
  if (!safety.compatible) throw new Error(`Unsafe component: ${safety.errors.join(" ")}`);
  if (input.requireAnimation && !/props\.localTime\b/.test(code) && !/\{[^}]*\blocalTime\b[^}]*\}\s*=\s*props\b/.test(code)) throw new Error("Animation must use props.localTime.");
  return {
    type: "component_result",
    expectedRevision: input.expectedRevision,
    elementId: input.elementId,
    name: requiredString(value.name, "name"),
    description: requiredString(value.description, "description"),
    propsSchema: parseSchema(value.propsSchema),
    code,
    reply: requiredString(value.reply, "reply"),
  };
}

function parseOperation(value: unknown, index: number): EditorOperation {
  const item = record(value);
  if (!item || typeof item.type !== "string") throw new Error(`Operation ${index + 1} requires a type.`);
  switch (item.type) {
    case "create_track": return { type: item.type, temporaryId: newId(item.temporaryId, "temporaryId"), trackType: item.trackType === "audio" ? "audio" : "visual", ...(optionalString(item.name) ? { name: optionalString(item.name) } : {}), ...(finite(item.position) ? { position: Number(item.position) } : {}) };
    case "delete_track": return { type: item.type, trackId: requiredString(item.trackId, "trackId") };
    case "delete_element": return { type: item.type, elementId: requiredString(item.elementId, "elementId") };
    case "move_element": return { type: item.type, elementId: requiredString(item.elementId, "elementId"), trackId: requiredString(item.trackId, "trackId"), startTime: requiredNumber(item.startTime, "startTime") };
    case "update_element": {
      const patch = record(item.patch);
      if (!patch || Object.keys(patch).length === 0) throw new Error(`Operation ${index + 1} update_element requires patch.`);
      return { type: item.type, elementId: requiredString(item.elementId, "elementId"), patch: {
        ...(optionalString(patch.name) ? { name: optionalString(patch.name) } : {}),
        ...(finite(patch.startTime) ? { startTime: Number(patch.startTime) } : {}),
        ...(finite(patch.duration) ? { duration: Number(patch.duration) } : {}),
        ...(finite(patch.trimStart) ? { trimStart: Number(patch.trimStart) } : {}),
        ...(finite(patch.trimEnd) ? { trimEnd: Number(patch.trimEnd) } : {}),
        ...(record(patch.params) ? { params: record(patch.params)! } : {}),
      } };
    }
    case "add_media": return { type: item.type, mediaId: requiredString(item.mediaId, "mediaId"), trackId: requiredString(item.trackId, "trackId"), startTime: requiredNumber(item.startTime, "startTime"), ...(finite(item.duration) ? { duration: Number(item.duration) } : {}) };
    case "edit_component": return { type: item.type, elementId: requiredString(item.elementId, "elementId"), instruction: requiredString(item.instruction, "instruction") };
    case "create_component": return { type: item.type, temporaryElementId: newId(item.temporaryElementId, "temporaryElementId"), trackId: requiredString(item.trackId, "trackId"), name: requiredString(item.name, "name"), startTime: requiredNumber(item.startTime, "startTime"), duration: requiredNumber(item.duration, "duration"), ...(record(item.params) ? { params: record(item.params)! } : {}), instruction: requiredString(item.instruction, "instruction") };
    default: throw new Error(`Unsupported operation ${item.type}.`);
  }
}

function validateTimeline(tracks: TimelineTrack[]) {
  const trackIds = new Set<string>();
  const elementIds = new Set<string>();
  if (!tracks.length || tracks.length > 32) throw new Error("Result must contain 1-32 tracks.");
  for (const track of tracks) {
    if (trackIds.has(track.id)) throw new Error(`Duplicate track ${track.id}.`);
    trackIds.add(track.id);
    track.elements.sort((a, b) => a.startTime - b.startTime);
    let end = 0;
    for (const element of track.elements) {
      if (elementIds.has(element.id)) throw new Error(`Duplicate element ${element.id}.`);
      elementIds.add(element.id);
      if (element.duration <= 0 || element.trimStart < 0 || element.trimEnd < 0 || element.trimStart + element.trimEnd >= element.duration) throw new Error(`Invalid timing for ${element.id}.`);
      if (element.startTime < end - 0.001) throw new Error(`Elements overlap on track ${track.id}.`);
      end = elementEnd(element);
    }
  }
}

function parseJsonObject(source: string) {
  const candidate = source.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let value: unknown;
  try { value = JSON.parse(candidate); } catch { throw new Error("Response must be valid JSON."); }
  const result = record(value);
  if (!result) throw new Error("Response must be one JSON object.");
  return result;
}

function parseSchema(value: unknown): ComponentResult["propsSchema"] {
  if (!Array.isArray(value)) throw new Error("propsSchema must be an array.");
  return value.slice(0, 30).map((row) => {
    const item = record(row);
    const name = requiredString(item?.name, "propsSchema.name");
    const type = item?.type;
    if (type !== "string" && type !== "number" && type !== "boolean" && type !== "color") throw new Error(`Invalid propsSchema type for ${name}.`);
    return { name, type, ...(item?.default !== undefined ? { default: item.default } : {}) };
  });
}

function cleanParams(value: JsonRecord) {
  return Object.fromEntries(Object.entries(value).filter(([key, item]) => /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key) && !["__proto__", "prototype", "constructor"].includes(key) && item !== undefined)) as Partial<ElementParams>;
}
function defaults(): ElementParams { return { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, zIndex: 1, volume: 1 }; }
function record(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null; }
function requiredString(value: unknown, name: string) { if (typeof value !== "string" || !value.trim()) throw new Error(`${name} must be a non-empty string.`); return value.trim(); }
function optionalString(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function requiredNumber(value: unknown, name: string) { if (!finite(value)) throw new Error(`${name} must be finite.`); return Number(value); }
function finite(value: unknown) { return typeof value === "number" && Number.isFinite(value); }
function nonNegative(value: number) { return Math.max(0, value); }
function framePositive(value: number, fps: number) { return Math.max(1 / fps, Math.round(value * fps) / fps); }
function newId(value: unknown, name: string) { const result = requiredString(value, name); if (!result.startsWith("new:")) throw new Error(`${name} must start with new:.`); return result; }
