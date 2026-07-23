"use client";

// Active-project store. Owns the ShiftCut revision counter: bumpRevision() is
// called by every mutating action across stores, so revision stays the single
// source of truth for "has this project changed" (PRD / MCP contract).

import { create } from "zustand";
import { storageService } from "@/lib/storage/storage-service";
import { uid } from "@/lib/utils";
import { DEFAULT_SETTINGS, type ProjectSettings, type TProject } from "@/types/project";

interface ProjectStore {
  activeProject: TProject | null;
  loading: boolean;
  notFound: boolean;

  loadProject: (id: string) => Promise<void>;
  createProject: (name?: string) => Promise<TProject>;
  rename: (name: string) => void;
  updateSettings: (patch: Partial<ProjectSettings>) => void;
  setSettingsForCommit: (settings: ProjectSettings) => void;
  bumpRevision: () => TProject | null; // called after any mutation
}

function persist(p: TProject) {
  void storageService.saveProject(p);
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  activeProject: null,
  loading: true,
  notFound: false,

  loadProject: async (id) => {
    set({ loading: true, notFound: false });
    const p = await storageService.loadProject(id);
    if (!p) set({ notFound: true, loading: false, activeProject: null });
    else set({ activeProject: p, loading: false });
  },

  createProject: async (name = "Untitled project") => {
    const now = Date.now();
    const p: TProject = {
      id: uid("proj"),
      name,
      revision: 0,
      settings: { ...DEFAULT_SETTINGS },
      createdAt: now,
      updatedAt: now,
    };
    await storageService.saveProject(p);
    return p;
  },

  rename: (name) => {
    const p = get().activeProject;
    if (!p) return;
    const next = { ...p, name };
    set({ activeProject: next });
    get().bumpRevision();
  },

  updateSettings: (patch) => {
    const p = get().activeProject;
    if (!p) return;
    set({ activeProject: { ...p, settings: { ...p.settings, ...patch } } });
    get().bumpRevision();
  },

  // Used by atomic cross-store transactions. The timeline commit performs the
  // single revision bump after both settings and tracks are staged.
  setSettingsForCommit: (settings) => {
    const p = get().activeProject;
    if (!p) return;
    set({ activeProject: { ...p, settings: { ...settings } } });
  },

  bumpRevision: () => {
    const p = get().activeProject;
    if (!p) return null;
    const next = { ...p, revision: p.revision + 1, updatedAt: Date.now() };
    set({ activeProject: next });
    persist(next);
    return next;
  },
}));
