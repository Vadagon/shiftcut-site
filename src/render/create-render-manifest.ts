import { storageService } from "@/lib/storage/storage-service";
import type { ComponentArtifact, MediaFileData } from "@/lib/storage/types";
import type { TProject } from "@/types/project";
import { effectiveDuration, totalDuration, type TimelineTrack } from "@/types/timeline";
import type { PreparedRenderManifest, RenderAsset, RenderWarning } from "./types";
import { validateGeneratedComponent } from "@/components/generated-component-runtime";

export async function createRenderManifest({
  project,
  tracks,
  pool,
  components,
  range,
}: {
  project: TProject;
  tracks: TimelineTrack[];
  pool: MediaFileData[];
  components: Record<string, ComponentArtifact>;
  range?: { start: number; end: number };
}): Promise<PreparedRenderManifest> {
  const frozenProject = structuredClone(project);
  const frozenTracks = structuredClone(tracks);
  const frozenComponents = structuredClone(components);
  const mediaIds = [...new Set(frozenTracks.flatMap((track) => track.elements.flatMap((element) => element.mediaId ? [element.mediaId] : [])))];
  const metadata = new Map(pool.map((item) => [item.id, item]));
  const urls: string[] = [];
  const assets: Record<string, RenderAsset> = {};

  try {
    for (const mediaId of mediaIds) {
      const item = metadata.get(mediaId);
      if (!item) throw new Error(`Asset metadata is missing for ${mediaId}.`);
      const blob = await storageService.getMediaBlob(mediaId);
      if (!blob) throw new Error(`The local file for “${item.name}” is missing.`);
      const url = URL.createObjectURL(blob);
      urls.push(url);
      assets[mediaId] = { ...structuredClone(item), url };
    }
  } catch (error) {
    for (const url of urls) URL.revokeObjectURL(url);
    throw error;
  }

  const warnings: RenderWarning[] = frozenTracks.flatMap((track) => track.elements.flatMap((element) => {
    if (element.component !== "GeneratedReactComponent") return [];
    const artifact = element.componentId ? frozenComponents[element.componentId] : undefined;
    if (!artifact) throw new Error(`AI component source is missing for “${element.name}”.`);
    const compatibility = validateGeneratedComponent(artifact.code);
    if (!compatibility.compatible) throw new Error(`“${element.name}” cannot be exported: ${compatibility.errors.join(" ")} Regenerate the component for export.`);
    return [{
      elementId: element.id,
      elementName: element.name,
      message: `“${element.name}” will render with its deterministic AI animation.`,
    }];
  }));

  const fps = Math.max(1, frozenProject.settings.fps);
  const timelineDuration = Math.max(
    1 / fps,
    totalDuration(frozenTracks),
    ...frozenTracks.flatMap((track) => track.elements.map((element) => element.startTime + Math.max(0, effectiveDuration(element)))),
  );
  const rangeStart = Math.max(0, range?.start ?? 0);
  const rangeEnd = Math.min(timelineDuration, range?.end ?? timelineDuration);
  if (rangeEnd <= rangeStart) {
    for (const url of urls) URL.revokeObjectURL(url);
    throw new Error("Export range must end after it starts.");
  }
  const startFrame = Math.floor(rangeStart * fps);
  const endFrame = Math.max(startFrame + 1, Math.ceil(rangeEnd * fps));

  return {
    manifest: {
      id: `${frozenProject.id}-r${frozenProject.revision}-${Date.now()}`,
      createdAt: Date.now(),
      project: frozenProject,
      tracks: frozenTracks,
      assets,
      components: frozenComponents,
      durationInFrames: endFrame - startFrame,
      range: { startFrame, endFrame },
      warnings,
    },
    release: () => {
      for (const url of urls) URL.revokeObjectURL(url);
    },
  };
}
