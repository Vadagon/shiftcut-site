// Timeline domain types. Structure adapted from OpenCut (MIT, see /NOTICE):
// tracks OWN their elements; an element is positioned by startTime and trimmed
// by trimStart/trimEnd against its source duration.
// UltraCut addition: every element carries a `params` bag (transform + type-
// specific values) that drives the HTML preview + inspector + MCP.

export type TrackType = "media" | "text" | "audio";

export interface ElementParams {
  // transform (required for every element)
  x: number;
  y: number;
  scale: number;
  scaleX?: number;
  scaleY?: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  // type-specific (open-ended)
  filter?: string;
  text?: string;
  color?: string;
  fontSize?: number;
  volume?: number;
  [key: string]: unknown;
}

export interface TimelineElement {
  id: string;
  type: "media" | "text";
  mediaId?: string; // -> MediaItem.id (for media elements)
  name: string;
  /** What this instance renders or plays. */
  description?: string;
  /** Why this instance exists in the complete composition. */
  purpose?: string;
  component: string; // player component key: VideoPlayer | ImagePlayer | AudioPlayer | TextPlayer
  // Generated overlays reference a registry artifact. Their source never
  // lives in the timeline document after migration.
  componentId?: string;
  componentVersion?: number;
  /** @deprecated Legacy migration input only. Never persisted in a timeline. */
  componentCode?: string;
  /** @deprecated Legacy migration input only. */
  componentName?: string;
  /** @deprecated Legacy migration input only. */
  componentDescription?: string;
  /** @deprecated Legacy migration input only. */
  componentPropsSchema?: Array<{ name: string; type: "string" | "number" | "boolean" | "color"; default?: unknown }>;
  startTime: number; // position on the timeline (seconds)
  duration: number; // source length (seconds)
  trimStart: number; // trimmed from the head (seconds)
  trimEnd: number; // trimmed from the tail (seconds)
  params: ElementParams;
}

export type CreateTimelineElement = Omit<TimelineElement, "id">;

export interface TimelineTrack {
  id: string;
  name: string;
  type: TrackType;
  elements: TimelineElement[];
  muted: boolean;
  hidden: boolean;
  locked: boolean;
}

/** A track is a lane, not merely a visual label. Media, overlays, and audio
 * have separate lanes so an audio drop can never become a visual layer. */
export function elementTrackType(element: Pick<TimelineElement, "type" | "component">): TrackType {
  if (element.component === "AudioPlayer") return "audio";
  // Text, React motion graphics, images, and video share one visual stack.
  // A lane's vertical position—not a separate media category—defines whether
  // an overlay appears over the picture beneath it.
  return "media";
}

export function canPlaceElementOnTrack(element: Pick<TimelineElement, "type" | "component">, track: Pick<TimelineTrack, "type">) {
  return elementTrackType(element) === track.type;
}

export interface DragState {
  isDragging: boolean;
  elementId: string | null;
  trackId: string | null;
  startMouseX: number;
  startElementTime: number;
  clickOffsetTime: number;
  currentTime: number;
}

export const effectiveDuration = (el: TimelineElement) =>
  el.duration - el.trimStart - el.trimEnd;

export const elementEnd = (el: TimelineElement) =>
  el.startTime + effectiveDuration(el);

export function totalDuration(tracks: TimelineTrack[]): number {
  let max = 0;
  for (const t of tracks) for (const e of t.elements) max = Math.max(max, elementEnd(e));
  return max;
}
