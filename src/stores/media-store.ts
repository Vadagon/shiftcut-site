"use client";

// Media store — the GLOBAL asset pool + per-project membership.
// Import goes: processFile -> storageService.saveMedia (IndexedDB meta + OPFS binary).

import { create } from "zustand";
import { storageService } from "@/lib/storage/storage-service";
import { processFile } from "@/lib/media-processing";
import type { MediaFileData } from "@/lib/storage/types";
import { useProjectStore } from "./project-store";

interface MediaStore {
  pool: MediaFileData[]; // all media, all projects
  projectAssetIds: string[]; // subset belonging to the active project
  _projectId: string | null;

  loadPool: () => Promise<void>;
  loadForProject: (projectId: string) => Promise<void>;
  importFiles: (files: FileList | File[]) => Promise<void>;
  addToProject: (ids: string[]) => Promise<void>;
  byId: (id: string) => MediaFileData | undefined;
}

export const useMediaStore = create<MediaStore>((set, get) => {
  const saveMembership = () => {
    const id = get()._projectId;
    if (id) void storageService.setMembership(id, get().projectAssetIds);
  };

  return {
    pool: [],
    projectAssetIds: [],
    _projectId: null,

    loadPool: async () => set({ pool: await storageService.listMedia() }),

    loadForProject: async (projectId) => {
      const [pool, ids] = await Promise.all([
        storageService.listMedia(),
        storageService.getMembership(projectId),
      ]);
      set({ pool, projectAssetIds: ids, _projectId: projectId });
    },

    importFiles: async (files) => {
      const imported: string[] = [];
      for (const f of Array.from(files)) {
        const { meta, blob } = await processFile(f);
        await storageService.saveMedia(meta, blob);
        imported.push(meta.id);
      }
      set({ pool: await storageService.listMedia() });
      await get().addToProject(imported);
    },

    addToProject: async (ids) => {
      const set2 = new Set([...get().projectAssetIds, ...ids]);
      set({ projectAssetIds: [...set2] });
      saveMembership();
      useProjectStore.getState().bumpRevision();
    },

    byId: (id) => get().pool.find((m) => m.id === id),
  };
});
