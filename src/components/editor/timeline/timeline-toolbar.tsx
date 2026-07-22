"use client";

import { useTimelineStore } from "@/stores/timeline-store";
import { usePlaybackStore } from "@/stores/playback-store";
import { useProjectStore } from "@/stores/project-store";
import { cn } from "@/lib/utils";
import { fmtTimecode } from "@/lib/time";
import { totalDuration } from "@/types/timeline";
import { I } from "../icons";

export function TimelineToolbar({
  pxPerSec, setPxPerSec, onFit,
}: {
  pxPerSec: number;
  setPxPerSec: (n: number) => void;
  onFit: () => void;
}) {
  const selectedElementId = useTimelineStore((s) => s.selectedElementId);
  const snappingEnabled = useTimelineStore((s) => s.snappingEnabled);
  const splitElement = useTimelineStore((s) => s.splitElement);
  const duplicateElement = useTimelineStore((s) => s.duplicateElement);
  const removeElement = useTimelineStore((s) => s.removeElement);
  const toggleEffect = useTimelineStore((s) => s.toggleEffect);
  const toggleSnapping = useTimelineStore((s) => s.toggleSnapping);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const toggle = usePlaybackStore((s) => s.toggle);
  const tracks = useTimelineStore((s) => s.tracks);
  const fps = useProjectStore((s) => s.activeProject?.settings.fps ?? 30);
  const sel = !!selectedElementId;

  const A = ({ children, onClick, title, disabled, active }: { children: React.ReactNode; onClick?: () => void; title: string; disabled?: boolean; active?: boolean }) => (
    <button title={title} onClick={onClick} disabled={disabled} className={cn("rounded-md p-1.5 disabled:opacity-30", active ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700")}>{children}</button>
  );

  return (
    <div className="flex h-[51px] items-center gap-1 border-b border-[#bdbab5] bg-[#dfddda] px-3 py-1.5">
      <A title="Split at playhead" onClick={() => selectedElementId && splitElement(selectedElementId, currentTime)} disabled={!sel}><I.cut width={17} height={17} /></A>
      <A title="Align left" disabled={!sel}><I.alignL width={17} height={17} /></A>
      <A title="Align right" disabled={!sel}><I.alignR width={17} height={17} /></A>
      <A title="Duplicate" onClick={() => selectedElementId && duplicateElement(selectedElementId)} disabled={!sel}><I.duplicate width={17} height={17} /></A>
      <A title="Toggle grayscale effect" onClick={() => selectedElementId && toggleEffect(selectedElementId)} disabled={!sel}><I.effects width={17} height={17} /></A>
      <A title="Delete" onClick={() => selectedElementId && removeElement(selectedElementId)} disabled={!sel}><I.trash width={17} height={17} /></A>
      <A title="Bookmark"><I.bookmark width={17} height={17} /></A>
      <A title="Keyframes (coming soon)" disabled><I.graph width={17} height={17} /></A>

      <div className="mx-auto flex items-center gap-3 font-mono text-[12px] tabular-nums text-[#625e58]">
        <button onClick={toggle} title={isPlaying ? "Pause" : "Play"} className="font-sans text-[#4e4a45] hover:text-black">{isPlaying ? <I.pause width={18} height={18} /> : <I.play width={18} height={18} />}</button>
        <span>{fmtTimecode(currentTime, fps)} / {fmtTimecode(totalDuration(tracks), fps)}</span>
      </div>

      <A title="Snapping" onClick={toggleSnapping} active={snappingEnabled}><I.magnet width={17} height={17} /></A>
      <A title="Fit timeline" onClick={onFit}><I.fit width={17} height={17} /></A>
      <A title="Zoom out" onClick={() => setPxPerSec(Math.max(20, pxPerSec - 20))}><I.zoomOut width={17} height={17} /></A>
      <input type="range" min={20} max={200} value={pxPerSec} onChange={(e) => setPxPerSec(parseInt(e.target.value))} className="w-28 accent-blue-500" />
      <A title="Zoom in" onClick={() => setPxPerSec(Math.min(200, pxPerSec + 20))}><I.zoomIn width={17} height={17} /></A>
    </div>
  );
}
