import { parseCompositionSource, parseShiftCutResponse, type ParsedCompositionResponse } from "@/lib/composition-dsl-parser";

export const SHIFT_CUT_AI_RESPONSE_FORMAT = "shiftcut-ai-jsx/v1";

type CurrentComposition = ReturnType<typeof parseCompositionSource>;

export function buildShiftCutSystemPrompt(input: {
  projectName: string;
  composition: string;
  memory: string;
  selectedElementId: string | null;
  suggestedElementId: string | null;
  animationRequested: boolean;
}) {
  const current = parseCompositionSource(input.composition);
  return `You are ShiftCut's video-editing assistant for "${input.projectName}".

The complete current video is provided below as restricted JSX. It is the only current project source. It includes canvas settings, ordered tracks, clips, assets, parameters, and complete source/schema blocks for every React component referenced by this revision.

Return ONLY one restricted JSX expression. Never return JSON, Markdown fences, comments, prose outside the root, imports, fragments, spreads, variables, or arbitrary JSX expressions.

For an edit, wrap one complete updated copy of the supplied ShiftCutComposition directly inside a ShiftCutResponse with format="${SHIFT_CUT_AI_RESPONSE_FORMAT}", expectedRevision={${current.revision}}, and a short literal reply attribute. Do not abbreviate the composition or write ellipses/placeholders.

For a question or clarification:
<ShiftCutResponse format="${SHIFT_CUT_AI_RESPONSE_FORMAT}" expectedRevision={${current.revision}} reply="Your answer">
  <NoChanges />
</ShiftCutResponse>

Always return the COMPLETE composition for an edit, not a patch. Preserve IDs for unchanged tracks, elements, assets, and ComponentDefinitions. Keep an existing definition id when changing its code; ShiftCut versions it. New definitions may use an id beginning with "new:". Remove empty tracks only when explicitly asked to restructure, clean up, replace, or rebuild the timeline.

Allowed tags: ShiftCutComposition, Assets, Asset, ComponentDefinitions, ComponentDefinition, Project, VisualTrack, AudioTrack, Video, Image, Audio, Text, and Component. Keep attributes in the supplied literal format. Component code, propsSchema, and params use String.raw templates. params contains JSON and may include arbitrary inspector values.

For every new definition use this exact shape:
<ComponentDefinition id={"new:uniqueName"} version={1} name={"ReadableName"} description={"What it renders and how it moves."} propsSchema={String.raw\`[{"name":"text","type":"string","default":"Title"}]\`} code={String.raw\`function GeneratedComponent(props) { return React.createElement('div', null, props.text); }\`} />
Reference it with componentId, not definitionId:
<Component id={"new-element-id"} name={"Readable timeline name"} componentId={"new:uniqueName"} componentVersion={1} start={0} duration={5} trimStart={0} trimEnd={0} params={String.raw\`{"text":"Title","x":540,"y":960,"scale":1,"rotation":0,"opacity":1,"zIndex":10}\`} />

Tracks are top-to-bottom: earlier VisualTracks render above later ones; AudioTracks follow visuals. Do not overlap clips within one track. Use frame-aligned timing at ${current.settings.fps} fps. Media tags reference matching supplied Asset IDs. Component tags reference included ComponentDefinitions.

Component source defines function GeneratedComponent(props), renders with React.createElement, and cannot use JSX, imports, network, timers, storage, browser/process globals, dynamic code, Date, performance, Math.random, CSS animations, or CSS transitions. Animation is deterministic and seek-safe from props.localTime. Inspector values are available both directly (props.text, props.explodeTime) and as props.params for compatibility. The component fills the canvas and applies its own transform.

This request implies animation: ${input.animationRequested}. If true, implement actual time-driven code using props.localTime. For vague impact/explosion requests, preserve the text and default to a readable hold, anticipation, deterministic full-circle burst, shockwave, and clean fade.

Selected element: ${input.selectedElementId ?? "none"}.
Suggested generated-component target: ${input.suggestedElementId ?? "none"}.
If neither identifies a requested target, ask one concise clarification with NoChanges.

The supplied revision is current truth, including after Undo. Do not trust older conversation statements over it.

Compact conversation memory (context only):
${input.memory || "(none)"}

COMPLETE CURRENT COMPOSITION:
${input.composition}`;
}

export function acceptShiftCutResponse(input: {
  rawContent: string;
  currentCompositionSource: string;
  animationRequested: boolean;
}) {
  const current = parseCompositionSource(input.currentCompositionSource);
  const parsed = parseShiftCutResponse(input.rawContent);
  validateAcceptedResponse(parsed, current, input.animationRequested);
  return {
    format: SHIFT_CUT_AI_RESPONSE_FORMAT,
    reply: parsed.reply,
    expectedRevision: parsed.expectedRevision,
    operations: parsed.noChanges ? [] : [{
      action: "replace_composition",
      tracks: parsed.tracks,
      componentDefinitions: parsed.componentDefinitions,
      compositionSource: parsed.compositionSource,
    }],
  };
}

function validateAcceptedResponse(response: ParsedCompositionResponse, current: CurrentComposition, animationRequested: boolean) {
  if (!response.reply.trim() || response.reply.length > 2_000) throw new Error("reply must be between 1 and 2000 characters.");
  if (response.expectedRevision !== current.revision) throw new Error(`expectedRevision must be ${current.revision}.`);
  if (response.noChanges) return;
  if (!response.compositionSource || !response.tracks || !response.componentDefinitions) throw new Error("An edit requires one complete composition.");
  const result = parseCompositionSource(response.compositionSource);
  if (result.revision !== current.revision) throw new Error("The returned composition must retain the current revision.");
  if (result.settings.width !== current.settings.width || result.settings.height !== current.settings.height || result.settings.fps !== current.settings.fps || result.settings.background !== current.settings.background) {
    throw new Error("Preserve Project width, height, fps, and background.");
  }
  const currentAssets = [...new Set(current.assets.map((asset) => `${asset.id}:${asset.kind}`))].sort().join("|");
  const returnedAssets = [...new Set(result.assets.map((asset) => `${asset.id}:${asset.kind}`))].sort().join("|");
  if (returnedAssets !== currentAssets) throw new Error("Preserve the complete supplied Assets list exactly.");
  for (const track of result.tracks) {
    const elements = Array.isArray(track.elements) ? track.elements as Array<Record<string, unknown>> : [];
    let end = 0;
    for (const element of [...elements].sort((a, b) => Number(a.startTime) - Number(b.startTime))) {
      const start = Number(element.startTime);
      const duration = Number(element.duration);
      const trimStart = Number(element.trimStart ?? 0);
      const trimEnd = Number(element.trimEnd ?? 0);
      if (!Number.isFinite(start) || !Number.isFinite(duration) || start < 0 || duration <= 0 || trimStart < 0 || trimEnd < 0 || trimStart + trimEnd >= duration) throw new Error("Every clip needs valid positive timing and trims.");
      if (Math.abs(start * current.settings.fps - Math.round(start * current.settings.fps)) > 0.001 || Math.abs(duration * current.settings.fps - Math.round(duration * current.settings.fps)) > 0.001) throw new Error(`Clip timing must align to ${current.settings.fps} fps.`);
      if (start < end - 0.001) throw new Error(`Track ${String(track.name)} contains overlapping elements.`);
      end = start + duration - trimStart - trimEnd;
    }
  }
  if (animationRequested && !result.componentDefinitions.some((definition) =>
    /props\.localTime\b/.test(definition.code)
    || /\{[^}]*\blocalTime\b[^}]*\}\s*=\s*props\b/.test(definition.code),
  )) {
    throw new Error("Animation requests require deterministic component code driven by props.localTime.");
  }
}
