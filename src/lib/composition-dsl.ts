import type { ComponentArtifact, MediaFileData } from "@/lib/storage/types";
import type { ProjectSettings } from "@/types/project";
import type { TimelineElement, TimelineTrack } from "@/types/timeline";

export const SHIFT_CUT_COMPOSITION_FORMAT = "shiftcut-composition/v1";

type CompositionInput = {
  project: { name: string; revision: number; settings: ProjectSettings };
  tracks: TimelineTrack[];
  components: Record<string, ComponentArtifact>;
  assets: MediaFileData[];
};

function quoted(value: string) {
  return `{${JSON.stringify(value)}}`;
}

function raw(value: string) {
  return `String.raw\`${value.replace(/`/g, "\\`").replace(/\$\{/g, "\\${")}\``;
}

function number(value: number | undefined, fallback = 0) {
  return Number.isFinite(value) ? String(value) : String(fallback);
}

function elementTag(element: TimelineElement) {
  if (element.componentId) return "Component";
  if (element.component === "VideoPlayer") return "Video";
  if (element.component === "AudioPlayer") return "Audio";
  if (element.component === "ImagePlayer") return "Image";
  return "Text";
}

function frameTime(value: number, fps: number, minimumFrames = 0) {
  return Math.max(minimumFrames, Math.round(value * fps)) / fps;
}

function serializeElement(element: TimelineElement, fps: number) {
  const tag = elementTag(element);
  const identity = element.componentId
    ? ` componentId=${quoted(element.componentId)} componentVersion={${number(element.componentVersion, 1)}}`
    : element.mediaId
      ? ` assetId=${quoted(element.mediaId)}`
      : "";
  const duration = frameTime(element.duration, fps, 1);
  const trimStart = Math.min(frameTime(element.trimStart, fps), Math.max(0, duration - 1 / fps));
  const trimEnd = Math.min(frameTime(element.trimEnd, fps), Math.max(0, duration - trimStart - 1 / fps));
  return `        <${tag} id=${quoted(element.id)} name=${quoted(element.name)}${identity} start={${number(frameTime(element.startTime, fps))}} duration={${number(duration)}} trimStart={${number(trimStart)}} trimEnd={${number(trimEnd)}} params={${raw(JSON.stringify(element.params))}} />`;
}

export function serializeShiftCutComposition({ project, tracks, components, assets }: CompositionInput) {
  const fps = Math.max(1, project.settings.fps);
  const referencedIds = new Set(tracks.flatMap((track) => track.elements.flatMap((element) => element.componentId ? [element.componentId] : [])));
  const definitions = Object.values(components)
    .filter((component) => referencedIds.has(component.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((component) => [
      `      <ComponentDefinition id=${quoted(component.id)} version={${component.version}} name=${quoted(component.name)} description=${quoted(component.description)}`,
      `        propsSchema={${raw(JSON.stringify(component.propsSchema))}}`,
      `        code={${raw(component.code)}}`,
      "      />",
    ].join("\n"));
  const assetRows = assets
    .map((asset) => `      <Asset id=${quoted(asset.id)} name=${quoted(asset.name)} kind=${quoted(asset.kind)}${asset.duration === undefined ? "" : ` duration={${number(asset.duration)}}`}${asset.width === undefined ? "" : ` width={${number(asset.width)}}`}${asset.height === undefined ? "" : ` height={${number(asset.height)}}`} />`)
    .join("\n");
  const trackRows = tracks.map((track) => {
    const tag = track.type === "audio" ? "AudioTrack" : "VisualTrack";
    const elements = track.elements.map((element) => serializeElement(element, fps)).join("\n");
    return `      <${tag} id=${quoted(track.id)} name=${quoted(track.name)} muted={${track.muted}} hidden={${track.hidden}} locked={${track.locked}}>\n${elements}\n      </${tag}>`;
  }).join("\n");
  const { width, height, background = "#000000" } = project.settings;

  return `<ShiftCutComposition format=${quoted(SHIFT_CUT_COMPOSITION_FORMAT)} name=${quoted(project.name)} revision={${project.revision}}>
  <Assets>
${assetRows}
  </Assets>
  <ComponentDefinitions>
${definitions.join("\n")}
  </ComponentDefinitions>
  <Project width={${number(width)}} height={${number(height)}} fps={${number(fps)}} background=${quoted(background)}>
${trackRows}
  </Project>
</ShiftCutComposition>`;
}
