import type { ComponentArtifact, MediaFileData } from "@/lib/storage/types";
import type { TProject } from "@/types/project";
import type { TimelineTrack } from "@/types/timeline";

export interface RenderAsset extends MediaFileData {
  url: string;
}

export interface RenderWarning {
  elementId: string;
  elementName: string;
  message: string;
}

export interface RenderManifest {
  id: string;
  createdAt: number;
  project: TProject;
  tracks: TimelineTrack[];
  assets: Record<string, RenderAsset>;
  components: Record<string, ComponentArtifact>;
  durationInFrames: number;
  range: { startFrame: number; endFrame: number };
  warnings: RenderWarning[];
}

export interface PreparedRenderManifest {
  manifest: RenderManifest;
  release: () => void;
}

export type ExportQuality = "low" | "medium" | "high";

export interface LocalExportOptions {
  scale: number;
  quality: ExportQuality;
  includeAudio: boolean;
  signal: AbortSignal;
  onProgress: (progress: { progress: number; encodedFrames: number; estimatedTimeMs: number }) => void;
}
