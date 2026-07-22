"use client";

// Transient state for dragging a media item from the panel onto the timeline
// (pointer-based drag + ghost; not native HTML5 DnD).
import { create } from "zustand";

interface AssetDragStore {
  drag: { mediaId: string; x: number; y: number } | null;
  start: (mediaId: string, x: number, y: number) => void;
  move: (x: number, y: number) => void;
  clear: () => void;
}

export const useAssetDragStore = create<AssetDragStore>((set) => ({
  drag: null,
  start: (mediaId, x, y) => set({ drag: { mediaId, x, y } }),
  move: (x, y) => set((s) => (s.drag ? { drag: { ...s.drag, x, y } } : s)),
  clear: () => set({ drag: null }),
}));
