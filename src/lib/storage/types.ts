// Storage layer types. Adapter/service split adapted from OpenCut (MIT, /NOTICE).
import type { TimelineTrack } from "@/types/timeline";
import type { ProjectSettings } from "@/types/project";

export interface StorageConfig {
  projectsDb: string;
  mediaDb: string;
  timelineDb: string;
  version: number;
}

export interface SerializedProject {
  id: string;
  name: string;
  compositionDescription?: string;
  revision: number;
  settings: ProjectSettings;
  createdAt: number;
  updatedAt: number;
}

export interface MediaFileData {
  id: string;
  name: string;
  kind: "video" | "audio" | "image";
  mime: string;
  size: number;
  duration?: number;
  width?: number;
  height?: number;
  thumb?: string;
  createdAt: number;
}

export interface TimelineData {
  tracks: TimelineTrack[];
}

export interface ComponentArtifact {
  id: string;
  projectId: string;
  version: number;
  name: string;
  description: string;
  code: string;
  propsSchema: Array<{ name: string; type: "string" | "number" | "boolean" | "color"; default?: unknown }>;
  createdAt: number;
  updatedAt: number;
}

export interface ComponentRegistryData {
  projectId: string;
  components: ComponentArtifact[];
  updatedAt: number;
}

export interface ProjectRevision {
  projectId: string;
  revision: number;
  createdAt: number;
  summary: string;
  project: SerializedProject;
  tracks: TimelineTrack[];
  componentIds: string[];
}

export interface RevisionHistoryData {
  projectId: string;
  revisions: ProjectRevision[];
  updatedAt: number;
}

export interface ChatHistoryMessage {
  id?: string;
  role: "assistant" | "user";
  content: string;
  tools?: string;
  artifact?: Record<string, unknown>;
  status?: "pending" | "failed" | "complete";
  error?: string;
}

export interface ChatHistoryData {
  projectId: string;
  messages: ChatHistoryMessage[];
  updatedAt: number;
}

/** Compact model-facing memory. The complete chat transcript remains in
 * ChatHistoryData for the UI and diagnostics, but is not repeatedly sent to AI. */
export interface ChatMemoryData {
  projectId: string;
  summary: string;
  summarizedThroughMessageId: string;
  updatedAt: number;
}

export interface RenderJobSettings {
  scale: number;
  quality: "low" | "medium" | "high";
  includeAudio: boolean;
  rangeStart: number;
  rangeEnd: number;
  filename: string;
}

export interface RenderJob {
  id: string;
  projectId: string;
  revision: number;
  manifestId?: string;
  settings: RenderJobSettings;
  status: "queued" | "preparing" | "rendering" | "finalizing" | "complete" | "failed" | "cancelled";
  progress: number;
  encodedFrames?: number;
  estimatedTimeMs?: number;
  error?: string;
  output?: { id: string; mime: string; size: number };
  createdAt: number;
  completedAt?: number;
}
