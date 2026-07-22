// StorageService — single facade over the IndexedDB + OPFS adapters.
// Design adapted from OpenCut (MIT, /NOTICE): projects in one IndexedDB store,
// per-project media metadata (IndexedDB) + media binaries (OPFS), and per-project
// timeline (IndexedDB). ShiftCut renders HTML (not canvas), so media binaries are
// served back as object URLs for <video>/<img> in the preview.

import type { TProject } from "@/types/project";
import { IndexedDBAdapter } from "./indexeddb-adapter";
import { OPFSAdapter } from "./opfs-adapter";
import type {
  MediaFileData,
  SerializedProject,
  StorageConfig,
  TimelineData,
  ChatHistoryData,
  ComponentArtifact,
  ComponentRegistryData,
  ProjectRevision,
  RevisionHistoryData,
} from "./types";

class StorageService {
  private config: StorageConfig = {
    projectsDb: "shiftcut-projects",
    mediaDb: "shiftcut-media",
    timelineDb: "shiftcut-timeline",
    version: 1,
  };
  // NOTE: our IndexedDBAdapter creates exactly one object store per database,
  // so every logical store gets its OWN database name (no shared DBs).
  private projects = new IndexedDBAdapter<SerializedProject>(this.config.projectsDb, "projects", this.config.version);
  // Global media pool metadata (shared across projects, per PRD "global pool").
  private mediaMeta = new IndexedDBAdapter<MediaFileData>(this.config.mediaDb, "metadata", this.config.version);
  private mediaFiles = new OPFSAdapter("media-files");
  // Per-project asset membership (which pool assets belong to a project).
  private membership = new IndexedDBAdapter<string[]>("shiftcut-membership", "membership", this.config.version);
  private chatHistory = new IndexedDBAdapter<ChatHistoryData>("shiftcut-chat", "history", this.config.version);
  private revisions = new IndexedDBAdapter<RevisionHistoryData>("shiftcut-revisions", "history", this.config.version);

  private timelineAdapter(projectId: string) {
    return new IndexedDBAdapter<TimelineData>(`${this.config.timelineDb}-${projectId}`, "timeline", this.config.version);
  }
  private componentAdapter(projectId: string) {
    return new IndexedDBAdapter<ComponentRegistryData>(`shiftcut-components-${projectId}`, "components", this.config.version);
  }

  // ── Projects ──
  async listProjects(): Promise<TProject[]> {
    const rows = await this.projects.getAll();
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async loadProject(id: string): Promise<TProject | undefined> {
    return this.projects.get(id);
  }
  async saveProject(p: TProject): Promise<void> {
    const s: SerializedProject = { id: p.id, name: p.name, revision: p.revision, settings: p.settings, createdAt: p.createdAt, updatedAt: p.updatedAt };
    await this.projects.set(p.id, s);
  }
  async deleteProject(id: string): Promise<void> {
    await this.projects.remove(id);
    await this.membership.remove(id);
    await this.chatHistory.remove(id);
    await this.revisions.remove(id);
    await this.timelineAdapter(id).remove("main");
    await this.componentAdapter(id).remove("registry");
  }

  // ── Media (global pool) ──
  async listMedia(): Promise<MediaFileData[]> {
    const rows = await this.mediaMeta.getAll();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  }
  async getMedia(id: string): Promise<MediaFileData | undefined> {
    return this.mediaMeta.get(id);
  }
  async saveMedia(meta: MediaFileData, blob: Blob): Promise<void> {
    await this.mediaFiles.writeFile(meta.id, blob);
    await this.mediaMeta.set(meta.id, meta);
  }
  async getMediaBlob(id: string): Promise<Blob | null> {
    return this.mediaFiles.readFile(id);
  }
  async getMediaUrl(id: string): Promise<string | null> {
    const blob = await this.mediaFiles.readFile(id);
    return blob ? URL.createObjectURL(blob) : null;
  }

  // ── Project asset membership (which pool assets belong to a project) ──
  async getMembership(projectId: string): Promise<string[]> {
    return (await this.membership.get(projectId)) ?? [];
  }
  async setMembership(projectId: string, ids: string[]): Promise<void> {
    await this.membership.set(projectId, ids);
  }

  // ── Chat history (per project) ──
  async loadChatHistory(projectId: string): Promise<ChatHistoryData | undefined> {
    return this.chatHistory.get(projectId);
  }
  async saveChatHistory(projectId: string, messages: ChatHistoryData["messages"]): Promise<void> {
    await this.chatHistory.set(projectId, { projectId, messages, updatedAt: Date.now() });
  }

  // ── Timeline (per project) ──
  async loadTimeline(projectId: string): Promise<TimelineData | undefined> {
    return this.timelineAdapter(projectId).get("main");
  }
  async saveTimeline(projectId: string, data: TimelineData): Promise<void> {
    // A timeline is deliberately compact. Source code belongs in the
    // component registry, even if an old caller accidentally sends it here.
    const tracks = data.tracks.map((track) => ({ ...track, elements: track.elements.map((element) => {
      const { componentCode, componentName, componentDescription, componentPropsSchema, ...compact } = element;
      void componentCode; void componentName; void componentDescription; void componentPropsSchema;
      return compact;
    }) }));
    await this.timelineAdapter(projectId).set("main", { tracks });
  }

  async loadComponents(projectId: string): Promise<ComponentArtifact[]> {
    return (await this.componentAdapter(projectId).get("registry"))?.components ?? [];
  }
  async saveComponents(projectId: string, components: ComponentArtifact[]): Promise<void> {
    await this.componentAdapter(projectId).set("registry", { projectId, components, updatedAt: Date.now() });
  }

  async migrateInlineComponents(projectId: string, data: TimelineData | undefined): Promise<TimelineData | undefined> {
    if (!data) return data;
    const legacy = data.tracks.flatMap((track) => track.elements.filter((element) => Boolean(element.componentCode)));
    if (!legacy.length) return data;
    const components = await this.loadComponents(projectId);
    const byId = new Map(components.map((component) => [component.id, component]));
    const now = Date.now();
    const tracks = data.tracks.map((track) => ({ ...track, elements: track.elements.map((element) => {
      if (!element.componentCode) return element;
      const id = element.componentId ?? `cmp-${element.id}`;
      if (!byId.has(id)) {
        const artifact: ComponentArtifact = { id, projectId, version: element.componentVersion ?? 1, name: element.componentName ?? "GeneratedComponent", description: element.componentDescription ?? "AI-generated overlay", code: element.componentCode, propsSchema: element.componentPropsSchema ?? [], createdAt: now, updatedAt: now };
        components.push(artifact); byId.set(id, artifact);
      }
      const { componentCode, componentName, componentDescription, componentPropsSchema, ...compact } = element;
      void componentCode; void componentName; void componentDescription; void componentPropsSchema;
      return { ...compact, componentId: id, componentVersion: byId.get(id)?.version ?? 1 };
    }) }));
    await this.saveComponents(projectId, components);
    await this.saveTimeline(projectId, { tracks });
    return { tracks };
  }

  async appendRevision(projectId: string, revision: ProjectRevision): Promise<void> {
    const current = await this.revisions.get(projectId);
    const revisions = [...(current?.revisions ?? []), revision].slice(-100);
    await this.revisions.set(projectId, { projectId, revisions, updatedAt: Date.now() });
  }
  async loadRevisions(projectId: string): Promise<ProjectRevision[]> {
    return (await this.revisions.get(projectId))?.revisions ?? [];
  }
}

export const storageService = new StorageService();
