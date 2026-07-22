// Timeline layout constants. Naming mirrors OpenCut's timeline-constants (MIT).
import type { TrackType } from "@/types/timeline";

export const TIMELINE_CONSTANTS = {
  PIXELS_PER_SECOND: 80,
  ELEMENT_MIN_WIDTH: 20,
  TRACK_HEIGHT: 64,
  TRACK_GAP: 8,
  RULER_HEIGHT: 28,
  HEADER_WIDTH: 176,
  SNAP_THRESHOLD_PX: 8,
  ZOOM_MIN: 20,
  ZOOM_MAX: 200,
} as const;

export function getTrackHeight(): number {
  return TIMELINE_CONSTANTS.TRACK_HEIGHT;
}

export function getTrackElementClasses(type: TrackType): string {
  switch (type) {
    case "audio":
      return "bg-emerald-200";
    case "text":
      return "bg-violet-200";
    default:
      return "bg-blue-200";
  }
}
