import type { ComponentArtifact, MediaFileData } from "@/lib/storage/types";
import type { ProjectSettings } from "@/types/project";
import type { TimelineElement, TimelineTrack } from "@/types/timeline";

export const SHIFT_CUT_PROJECT_FORMAT = "shiftcut-project/v2";

type CompactProjectInput = {
  project: { name: string; revision: number; settings: ProjectSettings; compositionDescription?: string };
  tracks: TimelineTrack[];
  components: Record<string, ComponentArtifact>;
  assets: MediaFileData[];
};

function stringAttribute(value: string) {
  return `{${JSON.stringify(value)}}`;
}

function raw(value: string) {
  return `String.raw\`${value.replace(/`/g, "\\`").replace(/\$\{/g, "\\${")}\``;
}

function frameTime(value: number, fps: number, minimumFrames = 0) {
  return Math.max(minimumFrames, Math.round(value * fps)) / fps;
}

function parameterAttribute(name: string, value: unknown) {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name) || value === undefined) return "";
  if (typeof value === "string") return ` ${name}=${stringAttribute(value)}`;
  if (typeof value === "number" && Number.isFinite(value)) return ` ${name}={${value}}`;
  if (typeof value === "boolean") return ` ${name}={${value}}`;
  if (value === null || Array.isArray(value) || typeof value === "object") return ` ${name}={${raw(JSON.stringify(value))}}`;
  return "";
}

function elementTag(element: TimelineElement) {
  if (element.componentId) return "Component";
  if (element.component === "VideoPlayer") return "Video";
  if (element.component === "AudioPlayer") return "Audio";
  if (element.component === "ImagePlayer") return "Image";
  return "Text";
}

function serializeElement(element: TimelineElement, fps: number, trackName: string, components: Record<string, ComponentArtifact>) {
  const tag = elementTag(element);
  const identity = element.componentId
    ? ` componentId=${stringAttribute(element.componentId)} componentVersion={${element.componentVersion ?? 1}}`
    : element.mediaId
      ? ` assetId=${stringAttribute(element.mediaId)}`
      : "";
  const duration = frameTime(element.duration, fps, 1);
  const trimStart = Math.min(frameTime(element.trimStart, fps), Math.max(0, duration - 1 / fps));
  const trimEnd = Math.min(frameTime(element.trimEnd, fps), Math.max(0, duration - trimStart - 1 / fps));
  const params = Object.entries(element.params).map(([name, value]) => parameterAttribute(name, value)).join("");
  const artifact = element.componentId ? components[element.componentId] : undefined;
  const description = element.description?.trim() || artifact?.description || `${element.name} ${tag.toLowerCase()} element.`;
  const purpose = element.purpose?.trim() || `Contributes ${element.name} to the ${trackName} layer.`;
  return `      <${tag} elementId=${stringAttribute(element.id)} name=${stringAttribute(element.name)} description=${stringAttribute(description)} purpose=${stringAttribute(purpose)}${identity} start={${frameTime(element.startTime, fps)}} duration={${duration}} trimStart={${trimStart}} trimEnd={${trimEnd}}${params} />`;
}

export function serializeCompactProject({ project, tracks, components, assets }: CompactProjectInput) {
  const fps = Math.max(1, project.settings.fps);
  const referencedIds = new Set(tracks.flatMap((track) => track.elements.flatMap((element) => element.componentId ? [element.componentId] : [])));
  const assetRows = assets.map((asset) =>
    `    <Asset id=${stringAttribute(asset.id)} name=${stringAttribute(asset.name)} kind=${stringAttribute(asset.kind)}${asset.duration === undefined ? "" : ` duration={${asset.duration}}`}${asset.width === undefined ? "" : ` width={${asset.width}}`}${asset.height === undefined ? "" : ` height={${asset.height}}`} />`,
  ).join("\n");
  const componentRows = Object.values(components)
    .filter((component) => referencedIds.has(component.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((component) =>
      `    <ComponentSummary id=${stringAttribute(component.id)} version={${component.version}} name=${stringAttribute(component.name)} description=${stringAttribute(component.description)} propsSchema={${raw(JSON.stringify(component.propsSchema))}} />`,
    ).join("\n");
  const trackRows = tracks.map((track) => {
    const tag = track.type === "audio" ? "AudioTrack" : "VisualTrack";
    return `    <${tag} id=${stringAttribute(track.id)} name=${stringAttribute(track.name)} muted={${track.muted}} hidden={${track.hidden}} locked={${track.locked}}>
${track.elements.map((element) => serializeElement(element, fps, track.name, components)).join("\n")}
    </${tag}>`;
  }).join("\n");
  const { width, height, background = "#000000" } = project.settings;
  const compositionDescription = project.compositionDescription?.trim() || "A video composition whose durable creative description has not been written yet.";
  return `<ShiftCutProject format=${stringAttribute(SHIFT_CUT_PROJECT_FORMAT)} name=${stringAttribute(project.name)} description=${stringAttribute(compositionDescription)} revision={${project.revision}} width={${width}} height={${height}} fps={${fps}} background=${stringAttribute(background)}>
  <Assets>
${assetRows}
  </Assets>
  <Components>
${componentRows}
  </Components>
  <Timeline>
${trackRows}
  </Timeline>
</ShiftCutProject>`;
}
