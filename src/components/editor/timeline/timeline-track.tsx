"use client";

import { useTimelineStore } from "@/stores/timeline-store";
import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";
import { cn } from "@/lib/utils";
import type { TimelineTrack as TTrack } from "@/types/timeline";
import { I } from "../icons";
import { TimelineElement } from "./timeline-element";

const { TRACK_HEIGHT, TRACK_GAP } = TIMELINE_CONSTANTS;

export function TrackHeader({ track, label }: { track: TTrack; label: string }) {
  return (
    <div className={cn("flex h-full items-center border-l-4 px-3", track.type === "audio" ? "border-[#62a777]" : "border-[#5996c6]")}>
      <div className="flex items-center gap-1.5">
        <span className={cn("inline-flex h-7 min-w-9 items-center justify-center rounded-[4px] px-1.5 text-[12px] font-semibold text-white", track.type === "audio" ? "bg-[#63a878]" : "bg-[#5b9acb]")}>{label}</span>
        <div className="flex items-center gap-0.5">
        <TrackToggle trackId={track.id} on={!track.hidden} k="hidden">{track.hidden ? <I.eyeOff width={14} height={14} /> : <I.eye width={14} height={14} />}</TrackToggle>
        <TrackToggle trackId={track.id} on={!track.muted} k="muted">{track.muted ? <I.volumeMute width={14} height={14} /> : <I.volume width={14} height={14} />}</TrackToggle>
        <TrackToggle trackId={track.id} on={track.locked} k="locked"><I.lock width={14} height={14} /></TrackToggle>
        </div>
      </div>
    </div>
  );
}

function TrackToggle({ trackId, on, k, children }: { trackId: string; on: boolean; k: "muted" | "hidden" | "locked"; children: React.ReactNode }) {
  const toggleTrack = useTimelineStore((state) => state.toggleTrack);
  return <button onClick={() => toggleTrack(trackId, k)} className={cn("rounded p-1 hover:bg-[#dfddda]", on ? "text-[#4c4944]" : "text-[#a9a59f]")}>{children}</button>;
}

export function TimelineTrackRow({
  track, pxPerSec, dropActive, selectedId, live,
  onElementMoveDown, onElementTrimDown, onElementContextMenu,
}: {
  track: TTrack;
  pxPerSec: number;
  dropActive: boolean;
  selectedId: string | null;
  live: { elementId: string; start: number; end?: number } | null;
  onElementMoveDown: (e: React.PointerEvent, elementId: string, trackId: string) => void;
  onElementTrimDown: (e: React.PointerEvent, elementId: string, trackId: string, side: "left" | "right") => void;
  onElementContextMenu: (e: React.MouseEvent, element: TTrack["elements"][number]) => void;
}) {
  const hasClips = track.elements.length > 0;
  return (
    <div
      className={cn(
        "relative border-b border-[#c9c7c2] transition-colors",
        dropActive ? "bg-[#e4eff8]" : hasClips ? "bg-[#e7e5e2]" : "bg-[#e1dfdc]",
      )}
      style={{ height: TRACK_HEIGHT, marginBottom: TRACK_GAP }}
      data-track-id={track.id}
    >
      {track.elements.map((el) => {
        const isLive = live?.elementId === el.id;
        return (
          <TimelineElement
            key={el.id}
            element={el}
            pxPerSec={pxPerSec}
            selected={selectedId === el.id}
            liveStart={isLive ? live!.start : undefined}
            liveEnd={isLive ? live!.end : undefined}
            onMoveDown={(e) => onElementMoveDown(e, el.id, track.id)}
            onTrimDown={(e, side) => onElementTrimDown(e, el.id, track.id, side)}
            onContextMenu={onElementContextMenu}
          />
        );
      })}
    </div>
  );
}
