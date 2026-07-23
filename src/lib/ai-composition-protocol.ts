import { parseCompactProject, parseComponentStageResponse, parseFirstStageResponse, type FirstStageResult } from "@/lib/composition-dsl-parser";
import type { ComponentArtifact } from "@/lib/storage/types";

export const SHIFT_CUT_AI_PROTOCOL = "shiftcut-ai/v2";

function raw(value: string) {
  return `String.raw\`${value.replace(/`/g, "\\`").replace(/\$\{/g, "\\${")}\``;
}

export function buildTimelineSystemPrompt(input: {
  projectName: string;
  compactProject: string;
  memory: string;
  selectedElementId: string | null;
  suggestedElementId: string | null;
}) {
  const current = parseCompactProject(input.compactProject);
  const componentTargets = current.tracks.flatMap((track) => (track.elements as Array<Record<string, unknown>>).flatMap((element) =>
    typeof element.componentId === "string"
      ? [`- elementId=${String(element.id)}, componentId=${element.componentId}, componentVersion=${String(element.componentVersion)}, name=${String(element.name)}`]
      : [],
  )).join("\n");
  return `You are ShiftCut's video-editing assistant for "${input.projectName}". The complete compact project below is the only current truth.

Return exactly one restricted JSX root and nothing else:

1. TimelineEdit — for track structure, timing, trims, media placement, text/transform/color/volume/other existing parameters. Return the COMPLETE ordered track list using normal JSX attributes.
2. RequestComponent — only when the request requires creating or changing React rendering/animation code that cannot be expressed through existing parameters.
3. NoChanges — for a question or necessary clarification.

Examples:
<NoChanges expectedRevision={${current.revision}} reply={"Which title should I change?"} />

<RequestComponent expectedRevision={${current.revision}} reply={"Loading the component source."} elementId={"existing-element-id"} componentId={"existing-component-id"} componentVersion={1} />

For a new custom component use new: IDs and include intended placement plus initial normal parameters:
<RequestComponent expectedRevision={${current.revision}} reply={"Creating the animation."} elementId={"new:title"} componentId={"new:title"} componentVersion={1} trackId={"existing-track-id"} name={"Exploding title"} start={0} duration={5} text={"Title"} x={540} y={960} scale={1} rotation={0} opacity={1} zIndex={10} />

A TimelineEdit contains VisualTrack and AudioTrack children. Every timeline element uses normal attributes:
<Component elementId={"el-title"} name={"Title"} componentId={"cmp-title"} componentVersion={3} start={0} duration={5} trimStart={0} trimEnd={0} text={"alalal"} x={540} y={960} color={"#fff"} />

Primitive parameters are normal JSX attributes. Use String.raw JSON only for arrays or nested objects. Do not use a params attribute.

TimelineEdit rules:
- Return every track and every preserved element, not a patch.
- Tracks are top-to-bottom; earlier VisualTracks render above later VisualTracks; AudioTracks follow.
- Preserve stable track, element, asset, and component IDs unless intentionally adding/removing something.
- Existing Component elements keep their componentId/version. TimelineEdit cannot invent component source.
- Never overlap elements in one track. Align start and duration to ${current.settings.fps} fps.
- Preserve empty tracks unless explicitly asked to restructure/clean up/rebuild.
- A text/property change such as changing "olalal" to "alalal" is TimelineEdit, not RequestComponent.
- RequestComponent is for source-level visual behavior such as a new explosion, particles, structure, or animation not already exposed by parameters.

Selected element: ${input.selectedElementId ?? "none"}.
Suggested generated-component target: ${input.suggestedElementId ?? "none"}.
Valid existing component target tuples (never mix identifiers from different lines):
${componentTargets || "(none)"}
When the user asks to improve, regenerate, intensify, restyle, or otherwise modify an existing visual and a selected/suggested generated component is listed, RequestComponent MUST use that existing element's exact elementId, componentId, and version. Never create a new: component unless the user explicitly asks to add, create, duplicate, or make another separate element.
Current revision: ${current.revision}. Every root must use expectedRevision={${current.revision}}.

Compact memory (context only):
${input.memory || "(none)"}

COMPACT PROJECT:
${input.compactProject}`;
}

export function acceptTimelineStage(input: { rawContent: string; compactProject: string; userRequest?: string; selectedElementId?: string | null; suggestedElementId?: string | null; requireComponentEdit?: boolean }) {
  const current = parseCompactProject(input.compactProject);
  const result = parseFirstStageResponse(input.rawContent);
  if (result.expectedRevision !== current.revision) throw new Error(`expectedRevision must be ${current.revision}.`);
  if (input.requireComponentEdit && result.type !== "request-component") {
    const validTargets = current.tracks.flatMap((track) => (track.elements as Array<Record<string, unknown>>).flatMap((element) =>
      typeof element.componentId === "string"
        ? [`elementId="${String(element.id)}" componentId="${element.componentId}" componentVersion={${String(element.componentVersion)}}`]
        : [],
    ));
    throw new Error(`This request changes animation/rendering code and requires RequestComponent, not ${result.type === "timeline-edit" ? "TimelineEdit" : "NoChanges"}. Use one exact target tuple: ${validTargets.join(" OR ") || "use matching new: IDs for a newly requested component"}.`);
  }
  if (result.type === "timeline-edit") validateTimeline(result, current);
  if (result.type === "request-component") validateComponentRequest(result, current, input.userRequest ?? "", input.selectedElementId ?? input.suggestedElementId ?? null);
  return result;
}

function validateTimeline(result: Extract<FirstStageResult, { type: "timeline-edit" }>, current: ReturnType<typeof parseCompactProject>) {
  if (!result.tracks.length || result.tracks.length > 32) throw new Error("TimelineEdit requires 1-32 complete tracks.");
  const assetKinds = new Map(current.assets.map((asset) => [asset.id, asset.kind]));
  const componentVersions = new Map(current.components.map((component) => [component.id, component.version]));
  const trackIds = new Set<string>();
  const elementIds = new Set<string>();
  for (const track of result.tracks) {
    if (typeof track.id !== "string" || trackIds.has(track.id)) throw new Error("Track IDs must be present and unique.");
    trackIds.add(track.id);
    const elements = Array.isArray(track.elements) ? track.elements as Array<Record<string, unknown>> : [];
    let occupiedUntil = 0;
    for (const element of [...elements].sort((a, b) => Number(a.startTime) - Number(b.startTime))) {
      if (typeof element.id !== "string" || elementIds.has(element.id)) throw new Error("Element IDs must be present and unique.");
      elementIds.add(element.id);
      const start = Number(element.startTime);
      const duration = Number(element.duration);
      const trimStart = Number(element.trimStart ?? 0);
      const trimEnd = Number(element.trimEnd ?? 0);
      if (!Number.isFinite(start) || !Number.isFinite(duration) || start < 0 || duration <= 0 || trimStart < 0 || trimEnd < 0 || trimStart + trimEnd >= duration) throw new Error("Every element needs valid positive timing and trims.");
      if (Math.abs(start * current.settings.fps - Math.round(start * current.settings.fps)) > 0.001 || Math.abs(duration * current.settings.fps - Math.round(duration * current.settings.fps)) > 0.001) throw new Error(`Element timing must align to ${current.settings.fps} fps.`);
      if (start < occupiedUntil - 0.001) throw new Error(`Track ${String(track.name)} contains overlapping elements.`);
      occupiedUntil = start + duration - trimStart - trimEnd;
      if (typeof element.mediaId === "string") {
        const kind = assetKinds.get(element.mediaId);
        if (!kind) throw new Error(`Unknown asset ${element.mediaId}.`);
        if ((track.type === "audio") !== (kind === "audio")) throw new Error(`Asset ${element.mediaId} is on an incompatible track.`);
      }
      if (typeof element.componentId === "string") {
        const version = componentVersions.get(element.componentId);
        if (!version) throw new Error(`TimelineEdit cannot invent component ${element.componentId}; request its source first.`);
        if (element.componentVersion !== version) throw new Error(`Component ${element.componentId} must preserve version ${version}.`);
        if (track.type !== "media") throw new Error("React components must be on visual tracks.");
      }
    }
  }
}

function validateComponentRequest(result: Extract<FirstStageResult, { type: "request-component" }>, current: ReturnType<typeof parseCompactProject>, userRequest: string, preferredElementId: string | null) {
  const isNew = result.componentId.startsWith("new:") && result.elementId.startsWith("new:");
  const explicitSeparateCreation = /\b(?:add|create|generate|duplicate)\s+(?:a|an|another|new|second|additional)\b|\b(?:new|another|second|additional)\s+(?:title|component|overlay|animation|element)\b/i.test(userRequest);
  const preferred = preferredElementId
    ? current.tracks.flatMap((track) => track.elements as Array<Record<string, unknown>>).find((element) => element.id === preferredElementId && typeof element.componentId === "string")
    : undefined;
  if (preferred && !explicitSeparateCreation && (result.elementId !== preferred.id || result.componentId !== preferred.componentId || result.componentVersion !== preferred.componentVersion)) {
    throw new Error(`Modify the existing target instead of creating a duplicate: use elementId="${String(preferred.id)}", componentId="${String(preferred.componentId)}", componentVersion={${String(preferred.componentVersion)}}.`);
  }
  if (isNew) {
    if (!result.trackId || typeof result.start !== "number" || typeof result.duration !== "number" || result.duration <= 0) throw new Error("A new component request requires trackId, start, and positive duration.");
    if (!current.tracks.some((track) => track.id === result.trackId && track.type === "media")) throw new Error("A new component must target an existing visual track.");
    return;
  }
  const found = current.tracks.flatMap((track) => track.elements as Array<Record<string, unknown>>).find((element) => element.id === result.elementId);
  if (!found) throw new Error(`Unknown component element "${result.elementId}". Use an exact elementId from the compact timeline or matching new: IDs.`);
  if (found.componentId !== result.componentId || found.componentVersion !== result.componentVersion) {
    throw new Error(`Identifier mismatch. For elementId="${result.elementId}", use componentId="${String(found.componentId)}" componentVersion={${String(found.componentVersion)}}.`);
  }
}

export function buildComponentSystemPrompt(input: {
  compactProject: string;
  originalRequest: string;
  request: Extract<FirstStageResult, { type: "request-component" }>;
  artifact?: ComponentArtifact;
}) {
  const current = parseCompactProject(input.compactProject);
  const existing = input.artifact
    ? `<CurrentComponent id={${JSON.stringify(input.artifact.id)}} version={${input.artifact.version}} name={${JSON.stringify(input.artifact.name)}} description={${JSON.stringify(input.artifact.description)}} propsSchema={${raw(JSON.stringify(input.artifact.propsSchema))}} code={${raw(input.artifact.code)}} />`
    : `<CurrentComponent id={${JSON.stringify(input.request.componentId)}} version={1} name={${JSON.stringify(input.request.name ?? "GeneratedComponent")}} description={"New component; create its complete implementation."} propsSchema={${raw("[]")}} code={${raw("function GeneratedComponent(props) { return React.createElement('div', null, props.text || 'Title'); }")}} />`;
  return `You are editing exactly one ShiftCut React component. Return one ComponentEdit JSX root and nothing else.

Required response:
<ComponentEdit expectedRevision={${current.revision}} targetElementId={${JSON.stringify(input.request.elementId)}} baseComponentId={${JSON.stringify(input.request.componentId)}} baseComponentVersion={${input.request.componentVersion}} reply={"Short summary"}>
  <ComponentDefinition name={"ReadableName"} description={"What it renders and how it moves."} propsSchema={String.raw\`[{"name":"text","type":"string","default":"Title"}]\`} code={String.raw\`function GeneratedComponent(props) { return React.createElement('div', null, props.text); }\`} />
</ComponentEdit>

The code must define function GeneratedComponent(props), use React.createElement only, compile without imports, and be deterministic. For motion, derive all state from props.localTime. Do not use JSX, fetch, browser/process globals, storage, timers, Date, performance, Math.random, CSS animations, or CSS transitions. Inspector values are available directly and under props.params. The component fills the canvas and applies its own x/y/scale/rotation/opacity behavior.

Original user request:
${input.originalRequest}

Requested target and placement:
${input.request.source}

Exact current component:
${existing}

Compact project context:
${input.compactProject}`;
}

export function acceptComponentStage(input: {
  rawContent: string;
  compactProject: string;
  request: Extract<FirstStageResult, { type: "request-component" }>;
  requireAnimation: boolean;
}) {
  const current = parseCompactProject(input.compactProject);
  const result = parseComponentStageResponse(input.rawContent);
  if (result.expectedRevision !== current.revision) throw new Error(`expectedRevision must be ${current.revision}.`);
  if (result.targetElementId !== input.request.elementId || result.baseComponentId !== input.request.componentId || result.baseComponentVersion !== input.request.componentVersion) {
    throw new Error("ComponentEdit target/base identifiers must match RequestComponent exactly.");
  }
  if (input.requireAnimation && !(/props\.localTime\b/.test(result.component.code) || /\{[^}]*\blocalTime\b[^}]*\}\s*=\s*props\b/.test(result.component.code))) {
    throw new Error("The requested animation must be driven deterministically by localTime.");
  }
  return result;
}
