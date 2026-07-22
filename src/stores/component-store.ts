"use client";

import { create } from "zustand";
import { uid } from "@/lib/utils";
import { storageService } from "@/lib/storage/storage-service";
import type { ComponentArtifact } from "@/lib/storage/types";

type ComponentInput = Pick<ComponentArtifact, "name" | "description" | "code" | "propsSchema">;

let saveTimer: ReturnType<typeof setTimeout> | null = null;

interface ComponentStore {
  projectId: string | null;
  components: Record<string, ComponentArtifact>;
  loadForProject: (projectId: string) => Promise<void>;
  upsert: (input: ComponentInput, componentId?: string) => ComponentArtifact;
  get: (componentId?: string) => ComponentArtifact | undefined;
}

export const useComponentStore = create<ComponentStore>((set, get) => {
  const persist = () => {
    const { projectId, components } = get();
    if (!projectId) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void storageService.saveComponents(projectId, Object.values(components)), 200);
  };
  return {
    projectId: null,
    components: {},
    loadForProject: async (projectId) => {
      const rows = await storageService.loadComponents(projectId);
      set({ projectId, components: Object.fromEntries(rows.map((component) => [component.id, component])) });
    },
    upsert: (input, componentId) => {
      const existing = componentId ? get().components[componentId] : undefined;
      const now = Date.now();
      const component: ComponentArtifact = {
        // Source is immutable: editing a component creates a new artifact
        // version. Old timeline revisions continue to resolve their code.
        id: uid("cmp"),
        projectId: get().projectId ?? "",
        version: (existing?.version ?? 0) + 1,
        name: input.name,
        description: input.description,
        code: input.code,
        propsSchema: input.propsSchema,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      set((state) => ({ components: { ...state.components, [component.id]: component } }));
      persist();
      return component;
    },
    get: (componentId) => componentId ? get().components[componentId] : undefined,
  };
});
