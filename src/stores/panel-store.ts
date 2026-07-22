"use client";

// Panel store — which left-rail panel is active.
import { create } from "zustand";

export type PanelKey =
  | "media" | "library" | "transcript" | "inspector" | "audio" | "text" | "stickers" | "effects"
  | "transitions" | "captions" | "adjust" | "settings";

interface PanelStore {
  active: PanelKey;
  setActive: (k: PanelKey) => void;
}

export const usePanelStore = create<PanelStore>((set) => ({
  active: "media",
  setActive: (active) => set({ active }),
}));
