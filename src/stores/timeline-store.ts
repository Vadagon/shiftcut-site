"use client";

// Timeline store. Structure/actions adapted from OpenCut (MIT, /NOTICE):
// tracks own elements; a transient dragState drives live rendering and mutations
// commit once. ShiftCut additions: every commit bumps the project revision and
// pushes an undo snapshot; rendering is HTML (elements carry a `params` bag).

import { create } from "zustand";
import { storageService } from "@/lib/storage/storage-service";
import { uid } from "@/lib/utils";
import { useProjectStore } from "./project-store";
import {
  effectiveDuration,
  elementEnd,
  canPlaceElementOnTrack,
  type CreateTimelineElement,
  type DragState,
  type ElementParams,
  type TimelineElement,
  type TimelineTrack,
  type TrackType,
} from "@/types/timeline";

const HISTORY_CAP = 100;

const emptyDrag: DragState = {
  isDragging: false,
  elementId: null,
  trackId: null,
  startMouseX: 0,
  startElementTime: 0,
  clickOffsetTime: 0,
  currentTime: 0,
};

function defaultTracks(): TimelineTrack[] {
  return [
    { id: "track-v1", name: "Video 1", type: "media", elements: [], muted: false, hidden: false, locked: false },
    { id: "track-a1", name: "Audio 1", type: "audio", elements: [], muted: false, hidden: false, locked: false },
  ];
}

// Timeline order is compositing order from top to bottom: one visual stack,
// then audio. Higher numbered visual lanes are above V1.
function arrangeTracks(tracks: TimelineTrack[]) {
  // Replacement payload order is the visual compositing contract: first
  // visual lane is topmost. Preserve it exactly; only normalize legacy text
  // lanes into the unified media stack and keep audio beneath visuals.
  const visual = tracks.filter((track) => track.type !== "audio").map((track) => ({ ...track, type: "media" as const }));
  const audio = tracks.filter((track) => track.type === "audio");
  return [...visual, ...audio];
}

interface TimelineStore {
  tracks: TimelineTrack[];
  selectedElementId: string | null;
  snappingEnabled: boolean;
  dragState: DragState;
  _history: TimelineTrack[][];
  _redo: TimelineTrack[][];
  _projectId: string | null;

  // lifecycle
  loadTimeline: (projectId: string) => Promise<void>;
  clearTimeline: () => void;

  // getters
  getTotalDuration: () => number;
  findElement: (elementId: string) => { track: TimelineTrack; element: TimelineElement } | null;

  // selection
  selectElement: (elementId: string | null) => void;

  // transient drag
  startDrag: (elementId: string, trackId: string, clickOffsetTime: number, startTime: number) => void;
  updateDragTime: (currentTime: number) => void;
  endDrag: () => void;

  // mutations (each commits: history + revision + persist)
  toggleSnapping: () => void;
  addTrack: (type: TrackType) => string;
  addTrackAt: (type: TrackType, index: number) => string;
  addElementToTrack: (trackId: string, element: CreateTimelineElement) => string;
  removeElement: (elementId: string) => void;
  moveElementToTrack: (elementId: string, toTrackId: string, startTime: number) => void;
  updateElementStartTime: (elementId: string, startTime: number) => void;
  updateElementTrim: (elementId: string, trimStart: number, trimEnd: number, startTime: number) => void;
  updateElementParams: (elementId: string, patch: Partial<ElementParams>) => void;
  updateElementComponent: (elementId: string, patch: Pick<TimelineElement, "componentId" | "componentVersion">) => void;
  replaceTimeline: (tracks: TimelineTrack[], summary?: string) => void;
  removeEmptyTracks: () => void;
  splitElement: (elementId: string, atTime: number) => void;
  duplicateElement: (elementId: string) => void;
  toggleEffect: (elementId: string) => void;
  toggleTrack: (trackId: string, key: "muted" | "hidden" | "locked") => void;
  checkOverlap: (trackId: string, start: number, end: number, exceptId: string) => boolean;

  // history
  undo: () => void;
  redo: () => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useTimelineStore = create<TimelineStore>((set, get) => {
  const persist = () => {
    const { _projectId, tracks } = get();
    if (!_projectId) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void storageService.saveTimeline(_projectId, { tracks }), 250);
  };

  const createRevision = (tracks: TimelineTrack[], summary: string) => {
    const project = useProjectStore.getState().bumpRevision();
    if (!project) return;
    const componentIds = [...new Set(tracks.flatMap((track) => track.elements.flatMap((element) => element.componentId ? [element.componentId] : [])))];
    void storageService.appendRevision(project.id, { projectId: project.id, revision: project.revision, createdAt: Date.now(), summary, project, tracks: structuredClone(tracks), componentIds });
  };

  // Apply a pure transform to tracks; snapshot history, create a durable
  // revision record, and persist the compact timeline.
  const commit = (fn: (tracks: TimelineTrack[]) => TimelineTrack[], summary = "Timeline updated") => {
    const prev = get().tracks;
    const next = fn(structuredClone(prev));
    set((s) => ({
      tracks: next,
      _history: [...s._history, prev].slice(-HISTORY_CAP),
      _redo: [],
    }));
    createRevision(next, summary);
    persist();
  };

  return {
    tracks: defaultTracks(),
    selectedElementId: null,
    snappingEnabled: true,
    dragState: emptyDrag,
    _history: [],
    _redo: [],
    _projectId: null,

    loadTimeline: async (projectId) => {
      const data = await storageService.migrateInlineComponents(projectId, await storageService.loadTimeline(projectId));
      const revisions = await storageService.loadRevisions(projectId);
      set({
        _projectId: projectId,
        // Loading must be read-only: never compact, delete, reorder, or
        // create project timeline data outside a user or AI revision.
        tracks: data?.tracks?.length ? data.tracks : defaultTracks(),
        // Rehydrate the timeline portion of persistent revision history so
        // header undo works after a browser refresh as well as in-session.
        _history: revisions.slice(0, -1).map((revision) => revision.tracks),
        _redo: [],
        selectedElementId: null,
        dragState: emptyDrag,
      });
    },

    clearTimeline: () => set({ tracks: defaultTracks(), _history: [], _redo: [] }),

    getTotalDuration: () => {
      const { tracks } = get();
      let max = 0;
      for (const t of tracks) for (const e of t.elements) max = Math.max(max, elementEnd(e));
      return max;
    },

    findElement: (elementId) => {
      for (const track of get().tracks) {
        const element = track.elements.find((e) => e.id === elementId);
        if (element) return { track, element };
      }
      return null;
    },

    selectElement: (elementId) => set({ selectedElementId: elementId }),

    startDrag: (elementId, trackId, clickOffsetTime, startTime) =>
      set({
        selectedElementId: elementId,
        dragState: { isDragging: true, elementId, trackId, startMouseX: 0, startElementTime: startTime, clickOffsetTime, currentTime: startTime },
      }),
    updateDragTime: (currentTime) => set((s) => ({ dragState: { ...s.dragState, currentTime } })),
    endDrag: () => set({ dragState: emptyDrag }),

    toggleSnapping: () => set((s) => ({ snappingEnabled: !s.snappingEnabled })),

    checkOverlap: (trackId, start, end, exceptId) => {
      const track = get().tracks.find((t) => t.id === trackId);
      if (!track) return false;
      return track.elements.some((e) => e.id !== exceptId && !(end <= e.startTime || start >= elementEnd(e)));
    },

    addTrack: (type) => {
      const visualType: TrackType = type === "text" ? "media" : type;
      const id = uid("track");
      commit((tracks) => {
        const next = createTrack(id, visualType, tracks);
        // New overlays / visual layers are inserted above their peers. Audio
        // remains below every visual lane.
        const index = visualType === "media" ? 0 : tracks.length;
        const insertAt = index < 0 ? tracks.length : index;
        return [...tracks.slice(0, insertAt), next, ...tracks.slice(insertAt)];
      });
      return id;
    },

    addTrackAt: (type, index) => {
      const visualType: TrackType = type === "text" ? "media" : type;
      const id = uid("track");
      commit((tracks) => {
        const next = createTrack(id, visualType, tracks);
        const boundedIndex = Math.max(0, Math.min(tracks.length, index));
        return [...tracks.slice(0, boundedIndex), next, ...tracks.slice(boundedIndex)];
      });
      return id;
    },

    addElementToTrack: (trackId, element) => {
      const id = uid("el");
      commit((tracks) =>
        tracks.map((t) => (t.id === trackId ? { ...t, elements: [...t.elements, { ...element, id }] } : t)),
      );
      return id;
    },

    removeElement: (elementId) => {
      commit((tracks) => tracks.map((t) => ({ ...t, elements: t.elements.filter((e) => e.id !== elementId) })));
      if (get().selectedElementId === elementId) set({ selectedElementId: null });
    },

    moveElementToTrack: (elementId, toTrackId, startTime) => {
      const destination = get().tracks.find((track) => track.id === toTrackId);
      const source = get().findElement(elementId);
      if (!destination || !source || !canPlaceElementOnTrack(source.element, destination)) return;
      commit((tracks) => {
        let moving: TimelineElement | null = null;
        const stripped = tracks.map((t) => ({
          ...t,
          elements: t.elements.filter((e) => {
            if (e.id === elementId) { moving = e; return false; }
            return true;
          }),
        }));
        if (!moving) return tracks;
        return stripped.map((t) => (t.id === toTrackId ? { ...t, elements: [...t.elements, { ...moving!, startTime }] } : t));
      });
    },

    updateElementStartTime: (elementId, startTime) => {
      commit((tracks) => tracks.map((t) => ({ ...t, elements: t.elements.map((e) => (e.id === elementId ? { ...e, startTime } : e)) })));
    },

    updateElementTrim: (elementId, trimStart, trimEnd, startTime) => {
      commit((tracks) => tracks.map((t) => ({ ...t, elements: t.elements.map((e) => (e.id === elementId ? { ...e, trimStart, trimEnd, startTime } : e)) })));
    },

    updateElementParams: (elementId, patch) => {
      commit((tracks) => tracks.map((t) => ({ ...t, elements: t.elements.map((e) => (e.id === elementId ? { ...e, params: { ...e.params, ...patch } } : e)) })));
    },

    updateElementComponent: (elementId, patch) => {
      commit((tracks) => tracks.map((t) => ({ ...t, elements: t.elements.map((e) => (e.id === elementId ? { ...e, ...patch } : e)) })));
    },

    replaceTimeline: (tracks, summary = "Timeline replaced") => {
      const next = arrangeTracks(structuredClone(tracks));
      commit(() => next, summary);
      set({ selectedElementId: null, dragState: emptyDrag });
    },

    removeEmptyTracks: () => {
      if (!get().tracks.some((track) => track.elements.length === 0)) return;
      commit((tracks) => tracks.filter((track) => track.elements.length > 0), "Removed empty tracks");
    },

    splitElement: (elementId, atTime) => {
      const found = get().findElement(elementId);
      if (!found) return;
      const { element: el } = found;
      const start = el.startTime;
      const end = elementEnd(el);
      if (atTime <= start + 0.05 || atTime >= end - 0.05) return;
      const leftDur = atTime - start; // effective seconds kept on the left
      commit((tracks) =>
        tracks.map((t) => ({
          ...t,
          elements: t.elements.flatMap((e) => {
            if (e.id !== elementId) return [e];
            const left: TimelineElement = { ...e, trimEnd: e.duration - e.trimStart - leftDur };
            const right: TimelineElement = { ...e, id: uid("el"), startTime: atTime, trimStart: e.trimStart + leftDur };
            return [left, right];
          }),
        })),
      );
    },

    duplicateElement: (elementId) => {
      const found = get().findElement(elementId);
      if (!found) return;
      const { track, element } = found;
      commit((tracks) =>
        tracks.map((t) =>
          t.id === track.id
            ? { ...t, elements: [...t.elements, { ...element, id: uid("el"), startTime: elementEnd(element), name: `${element.name} copy` }] }
            : t,
        ),
      );
    },

    toggleEffect: (elementId) => {
      const found = get().findElement(elementId);
      if (!found) return;
      const cur = found.element.params.filter === "grayscale" ? "none" : "grayscale";
      get().updateElementParams(elementId, { filter: cur });
    },

    toggleTrack: (trackId, key) => {
      commit((tracks) => tracks.map((t) => (t.id === trackId ? { ...t, [key]: !t[key] } : t)));
    },

    undo: () => {
      const { _history, tracks } = get();
      if (!_history.length) return;
      const prev = _history[_history.length - 1];
      set((s) => ({ tracks: prev, _history: s._history.slice(0, -1), _redo: [...s._redo, tracks] }));
      createRevision(prev, "Undo timeline change");
      persist();
    },
    redo: () => {
      const { _redo, tracks } = get();
      if (!_redo.length) return;
      const next = _redo[_redo.length - 1];
      set((s) => ({ tracks: next, _redo: s._redo.slice(0, -1), _history: [...s._history, tracks] }));
      createRevision(next, "Redo timeline change");
      persist();
    },
  };
});

function createTrack(id: string, type: TrackType, tracks: TimelineTrack[]): TimelineTrack {
  const sameType = tracks.filter((track) => track.type === type).length + 1;
  const label = type === "text" ? `Text ${sameType}` : type === "audio" ? `Audio ${sameType}` : `Video ${sameType}`;
  return { id, name: label, type, elements: [], muted: false, hidden: false, locked: false };
}

export { effectiveDuration, elementEnd };
