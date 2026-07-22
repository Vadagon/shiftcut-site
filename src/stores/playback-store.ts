"use client";

// Playback store — the transport clock. A single rAF loop advances currentTime
// while playing and stops at the timeline's total duration.

import { create } from "zustand";
import { useTimelineStore } from "./timeline-store";

interface PlaybackStore {
  currentTime: number;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (t: number) => void;
}

let raf: number | null = null;
let last = 0;

export const usePlaybackStore = create<PlaybackStore>((set, get) => {
  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  };
  const loop = (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    const dur = useTimelineStore.getState().getTotalDuration();
    const next = get().currentTime + dt;
    if (next >= dur) {
      set({ currentTime: dur, isPlaying: false });
      stop();
      return;
    }
    set({ currentTime: next });
    raf = requestAnimationFrame(loop);
  };

  return {
    currentTime: 0,
    isPlaying: false,
    play: () => {
      if (get().isPlaying) return;
      const dur = useTimelineStore.getState().getTotalDuration();
      if (get().currentTime >= dur) set({ currentTime: 0 });
      set({ isPlaying: true });
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    pause: () => {
      stop();
      set({ isPlaying: false });
    },
    toggle: () => (get().isPlaying ? get().pause() : get().play()),
    seek: (t) => set({ currentTime: Math.max(0, t) }),
  };
});
