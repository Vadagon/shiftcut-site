"use client";

// Timeline orchestrator. Interaction model adapted from OpenCut (MIT, /NOTICE):
// transient dragState drives live rendering; mutations commit ONCE on release
// (each commit bumps the UltraCut revision + pushes an undo snapshot).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTimelineStore } from "@/stores/timeline-store";
import { usePlaybackStore } from "@/stores/playback-store";
import { useProjectStore } from "@/stores/project-store";
import { useMediaStore } from "@/stores/media-store";
import { useAssetDragStore } from "@/stores/asset-drag-store";
import { usePanelStore } from "@/stores/panel-store";
import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";
import { fmtTimecode } from "@/lib/time";
import { canPlaceElementOnTrack, effectiveDuration, elementTrackType, totalDuration as computeTotal, type TimelineTrack, type TrackType } from "@/types/timeline";
import { TimelineToolbar } from "./timeline-toolbar";
import { TrackHeader, TimelineTrackRow } from "./timeline-track";

const { HEADER_WIDTH: HEADER_W, RULER_HEIGHT: RULER_H, TRACK_HEIGHT: TRACK_H, TRACK_GAP, SNAP_THRESHOLD_PX } = TIMELINE_CONSTANTS;
const ROW = TRACK_H + TRACK_GAP;
const INSERT_H = 12;

type TrimLive = { elementId: string; start: number; end: number } | null;
type DropTarget = { kind: "track"; trackId: string } | { kind: "insert"; type: TrackType; index: number } | null;
type LaneRow = { kind: "track"; track: TimelineTrack } | { kind: "insert"; type: TrackType; index: number; id: string };
type ClipContextMenu = { x: number; y: number; elementId: string; name: string } | null;

export function Timeline() {
  const tracks = useTimelineStore((s) => s.tracks);
  const dragState = useTimelineStore((s) => s.dragState);
  const snappingEnabled = useTimelineStore((s) => s.snappingEnabled);
  const selectedElementId = useTimelineStore((s) => s.selectedElementId);
  const totalDuration = useMemo(() => computeTotal(tracks), [tracks]);
  const store = useTimelineStore;
  const seek = usePlaybackStore((s) => s.seek);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const fps = useProjectStore((s) => s.activeProject?.settings.fps ?? 30);
  const byId = useMediaStore((s) => s.byId);
  const assetDrag = useAssetDragStore((s) => s.drag);
  const moveAssetDrag = useAssetDragStore((s) => s.move);
  const clearAssetDrag = useAssetDragStore((s) => s.clear);

  const [pxPerSec, setPxPerSec] = useState(80);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const [contextMenu, setContextMenu] = useState<ClipContextMenu>(null);
  const [trimLive, setTrimLive] = useState<TrimLive>(null);
  const trimRef = useRef<TrimLive>(null);
  useEffect(() => { trimRef.current = trimLive; }, [trimLive]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const trackHeaderScrollRef = useRef<HTMLDivElement>(null);
  const laneRef = useRef<HTMLDivElement>(null);

  const totalSec = Math.max(totalDuration, 15) + 4;
  const width = totalSec * pxPerSec;
  const laneRows = useMemo(() => buildLaneRows(tracks), [tracks]);
  const laneHeight = laneRows.reduce((height, row) => height + (row.kind === "track" ? ROW : INSERT_H), 0);

  const timeFromX = useCallback((clientX: number) => {
    const lane = laneRef.current;
    return lane ? Math.max(0, (clientX - lane.getBoundingClientRect().left) / pxPerSec) : 0;
  }, [pxPerSec]);

  const targetFromPoint = useCallback((clientX: number, clientY: number): DropTarget => {
    const target = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-track-id], [data-insert-type]");
    if (!target) return null;
    const trackId = target.dataset.trackId;
    if (trackId) return { kind: "track", trackId };
    const type = target.dataset.insertType as TrackType | undefined;
    const index = Number(target.dataset.insertIndex);
    return type && Number.isFinite(index) ? { kind: "insert", type, index } : null;
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", onKeyDown); };
  }, [contextMenu]);

  const snap = useCallback((sec: number, exceptId?: string): number => {
    if (!snappingEnabled) return sec;
    const targets = [0, currentTime];
    for (const t of tracks) for (const e of t.elements) {
      if (e.id === exceptId) continue;
      targets.push(e.startTime, e.startTime + effectiveDuration(e));
    }
    for (const t of targets) if (Math.abs((sec - t) * pxPerSec) < SNAP_THRESHOLD_PX) return t;
    return sec;
  }, [snappingEnabled, currentTime, tracks, pxPerSec]);

  // ── ruler seek ──
  const onRulerDown = (e: React.PointerEvent) => {
    const go = (x: number) => seek(Math.min(timeFromX(x), totalDuration || timeFromX(x)));
    go(e.clientX);
    const move = (ev: PointerEvent) => go(ev.clientX);
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  // ── clip move (transient via store.dragState, commit once) ──
  const onElementMoveDown = (e: React.PointerEvent, elementId: string, trackId: string) => {
    e.stopPropagation();
    const track = tracks.find((t) => t.id === trackId);
    if (track?.locked) return;
    const el = track?.elements.find((x) => x.id === elementId);
    if (!el) return;
    usePanelStore.getState().setActive("inspector");
    const offset = timeFromX(e.clientX) - el.startTime;
    store.getState().startDrag(elementId, trackId, offset, el.startTime);
    const len = effectiveDuration(el);

    const move = (ev: PointerEvent) => {
      const ns = Math.max(0, snap(timeFromX(ev.clientX) - offset, elementId));
      store.getState().updateDragTime(ns);
      const candidate = targetFromPoint(ev.clientX, ev.clientY);
      const valid = candidate?.kind === "track"
        ? tracks.find((item) => item.id === candidate.trackId)
        : candidate?.kind === "insert" && candidate.type === elementTrackType(el);
      setDropTarget(valid ? candidate : null);
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      const finalStart = store.getState().dragState.currentTime;
      const target = targetFromPoint(ev.clientX, ev.clientY);
      store.getState().endDrag();
      setDropTarget(null);
      if (target?.kind === "insert" && target.type !== elementTrackType(el)) return;
      const targetTrack = target?.kind === "track" ? target.trackId : target?.kind === "insert" ? store.getState().addTrackAt(target.type, target.index) : trackId;
      const destination = store.getState().tracks.find((candidate) => candidate.id === targetTrack);
      if (!destination || !canPlaceElementOnTrack(el, destination)) return;
      if (store.getState().checkOverlap(targetTrack, finalStart, finalStart + len, elementId)) return;
      if (targetTrack === trackId) {
        if (finalStart !== el.startTime) store.getState().updateElementStartTime(elementId, finalStart);
      } else {
        store.getState().moveElementToTrack(elementId, targetTrack, finalStart);
      }
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  const onElementContextMenu = (event: React.MouseEvent, element: TimelineTrack["elements"][number]) => {
    event.preventDefault();
    event.stopPropagation();
    store.getState().selectElement(element.id);
    setContextMenu({ x: event.clientX, y: event.clientY, elementId: element.id, name: element.name });
  };

  const copyElement = async (elementId: string) => {
    const found = store.getState().findElement(elementId);
    if (!found) return;
    try { await navigator.clipboard.writeText(JSON.stringify({ type: "shiftcut/timeline-element", element: found.element }, null, 2)); } catch { /* Clipboard access is optional. */ }
  };

  const copyElementId = async (elementId: string) => {
    try { await navigator.clipboard.writeText(elementId); } catch { /* Clipboard access is optional. */ }
  };

  const runContextAction = (action: "delete" | "copy" | "copy-id" | "cut" | "inspector", elementId: string) => {
    if (action === "copy") void copyElement(elementId);
    if (action === "copy-id") void copyElementId(elementId);
    if (action === "cut") { void copyElement(elementId); store.getState().removeElement(elementId); }
    if (action === "delete") store.getState().removeElement(elementId);
    if (action === "inspector") { store.getState().selectElement(elementId); usePanelStore.getState().setActive("inspector"); }
    setContextMenu(null);
  };

  // ── clip trim (transient local, commit once) ──
  const onElementTrimDown = (e: React.PointerEvent, elementId: string, trackId: string, side: "left" | "right") => {
    e.stopPropagation();
    const track = tracks.find((t) => t.id === trackId);
    const el = track?.elements.find((x) => x.id === elementId);
    if (!el || track?.locked) return;
    store.getState().selectElement(elementId);
    const s0 = el.startTime, e0 = el.startTime + effectiveDuration(el);
    setTrimLive({ elementId, start: s0, end: e0 });

    const move = (ev: PointerEvent) => {
      const t = snap(timeFromX(ev.clientX), elementId);
      if (side === "left") setTrimLive({ elementId, start: Math.max(0, Math.min(e0 - 0.1, t)), end: e0 });
      else setTrimLive({ elementId, start: s0, end: Math.max(s0 + 0.1, t) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      const live = trimRef.current; setTrimLive(null);
      if (!live) return;
      if (side === "left") {
        const deltaTrim = live.start - s0; // seconds trimmed off the head
        store.getState().updateElementTrim(elementId, el.trimStart + deltaTrim, el.trimEnd, live.start);
      } else {
        const newEffective = live.end - live.start;
        const newTrimEnd = el.duration - el.trimStart - newEffective;
        store.getState().updateElementTrim(elementId, el.trimStart, Math.max(0, newTrimEnd), live.start);
      }
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  // ── panel -> timeline asset drop ──
  useEffect(() => {
    if (!assetDrag) return;
    const move = (ev: PointerEvent) => {
      moveAssetDrag(ev.clientX, ev.clientY);
      const target = targetFromPoint(ev.clientX, ev.clientY);
      const media = byId(assetDrag.mediaId);
      const expected = media?.kind === "audio" ? "audio" : "media";
      const valid = target?.kind === "track"
        ? tracks.find((track) => track.id === target.trackId)?.type === expected
        : target?.kind === "insert" && target.type === expected;
      setDropTarget(valid ? target : null);
    };
    const up = (ev: PointerEvent) => {
      const mediaId = assetDrag.mediaId;
      const target = targetFromPoint(ev.clientX, ev.clientY);
      clearAssetDrag(); setDropTarget(null);
      const media = byId(mediaId);
      if (!media) return;
      const expected = media.kind === "audio" ? "audio" : "media";
      if (target?.kind === "insert" && target.type !== expected) return;
      const trackId = target?.kind === "track" ? target.trackId : target?.kind === "insert" ? store.getState().addTrackAt(target.type, target.index) : null;
      if (!trackId) return;
      const track = store.getState().tracks.find((item) => item.id === trackId);
      if (!track) return;
      if (track.type !== (media.kind === "audio" ? "audio" : "media")) return;
      const dur = media.duration && media.duration > 0 ? media.duration : 5;
      let start = Math.max(0, snap(timeFromX(ev.clientX)));
      while (store.getState().checkOverlap(trackId, start, start + dur, "")) {
        const t = store.getState().tracks.find((x) => x.id === trackId);
        const clash = t?.elements.filter((o) => !(start + dur <= o.startTime || start >= o.startTime + effectiveDuration(o))).sort((a, b) => (b.startTime + effectiveDuration(b)) - (a.startTime + effectiveDuration(a)))[0];
        if (!clash) break;
        start = clash.startTime + effectiveDuration(clash);
      }
      const component = media.kind === "video" ? "VideoPlayer" : media.kind === "audio" ? "AudioPlayer" : "ImagePlayer";
      const zIndex = store.getState().tracks.reduce((n, t) => n + t.elements.length, 0);
      const id = store.getState().addElementToTrack(trackId, {
        type: "media", mediaId, name: media.name, component,
        startTime: start, duration: dur, trimStart: 0, trimEnd: 0,
        params: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, zIndex, volume: 1 },
      });
      store.getState().selectElement(id);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [assetDrag, moveAssetDrag, clearAssetDrag, targetFromPoint, tracks, byId, snap, timeFromX, store]);

  const onFit = () => setPxPerSec(Math.max(20, Math.min(200, ((scrollRef.current?.clientWidth ?? 800) - 40) / totalSec)));

  const syncVerticalScroll = (source: "timeline" | "headers") => {
    const from = source === "timeline" ? scrollRef.current : trackHeaderScrollRef.current;
    const to = source === "timeline" ? trackHeaderScrollRef.current : scrollRef.current;
    if (from && to && Math.abs(to.scrollTop - from.scrollTop) > 1) to.scrollTop = from.scrollTop;
  };

  const step = pxPerSec < 40 ? 5 : pxPerSec < 90 ? 2 : 1;
  const ticks: number[] = [];
  for (let s = 0; s <= totalSec; s += step) ticks.push(s);

  const liveFor = (elementId: string): { elementId: string; start: number; end?: number } | null => {
    if (dragState.isDragging && dragState.elementId === elementId) return { elementId, start: dragState.currentTime };
    if (trimLive?.elementId === elementId) return { elementId, start: trimLive.start, end: trimLive.end };
    return null;
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#e8e7e4]">
      <TimelineToolbar pxPerSec={pxPerSec} setPxPerSec={setPxPerSec} onFit={onFit} />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 shrink-0 flex-col border-r border-[#c9c7c2]" style={{ width: HEADER_W }}>
          <div style={{ height: RULER_H }} className="border-b border-[#c9c7c2]" />
          <div ref={trackHeaderScrollRef} onScroll={() => syncVerticalScroll("headers")} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            <div>
              {laneRows.map((row) => row.kind === "track" ? (
                <div key={row.track.id} style={{ height: TRACK_H, marginBottom: TRACK_GAP }}><TrackHeader track={row.track} label={trackLabel(tracks, row.track)} /></div>
              ) : <div key={row.id} className="border-b border-[#d8d5d0]" style={{ height: INSERT_H }} />)}
            </div>
          </div>
        </div>

        <div ref={scrollRef} onScroll={() => syncVerticalScroll("timeline")} className="relative min-w-0 flex-1 overflow-auto">
          <div ref={laneRef} className="relative" style={{ width }}>
            <div onPointerDown={onRulerDown} className="sticky top-0 z-20 cursor-ew-resize select-none border-b border-[#c9c7c2] bg-[#eeece9]" style={{ height: RULER_H }}>
              {ticks.map((s) => (
                <div key={s} className="absolute top-0 h-full" style={{ left: s * pxPerSec }}>
                  <div className="h-2 w-px bg-[#bdbab5]" />
                  <span className="absolute left-1 top-1.5 text-[9px] font-medium text-[#77736d]">{fmtTimecode(s, fps).slice(3, 8)}</span>
                </div>
              ))}
            </div>

            <div className="pointer-events-none absolute top-0 z-30" style={{ left: currentTime * pxPerSec, height: RULER_H + laneHeight }}>
              <div className="absolute -left-[7px] -top-0.5 h-0 w-0 border-x-[7px] border-t-[11px] border-x-transparent border-t-[#252321]" />
              <div className="absolute left-0 top-0 h-full w-px bg-[#252321]" />
            </div>

            <div>
              {laneRows.map((row) => row.kind === "track" ? (
                <TimelineTrackRow
                  key={row.track.id}
                  track={row.track}
                  pxPerSec={pxPerSec}
                  dropActive={dropTarget?.kind === "track" && dropTarget.trackId === row.track.id}
                  selectedId={selectedElementId}
                  live={row.track.elements.map((e) => liveFor(e.id)).find(Boolean) ?? null}
                  onElementMoveDown={onElementMoveDown}
                  onElementTrimDown={onElementTrimDown}
                  onElementContextMenu={onElementContextMenu}
                />
              ) : <NewTrackLane key={row.id} row={row} active={dropTarget?.kind === "insert" && dropTarget.type === row.type && dropTarget.index === row.index} />)}
            </div>
          </div>
        </div>
      </div>

      {assetDrag && <AssetGhost x={assetDrag.x} y={assetDrag.y} thumb={byId(assetDrag.mediaId)?.thumb} name={byId(assetDrag.mediaId)?.name} />}
      {contextMenu && <ClipContextMenu menu={contextMenu} onAction={runContextAction} />}
    </div>
  );
}

function trackLabel(tracks: ReturnType<typeof useTimelineStore.getState>["tracks"], track: ReturnType<typeof useTimelineStore.getState>["tracks"][number]) {
  const sameType = tracks.filter((candidate) => candidate.type === track.type);
  const position = sameType.findIndex((candidate) => candidate.id === track.id);
  const prefix = track.type === "text" ? "T" : track.type === "audio" ? "A" : "V";
  // Visual and text lane numbers increase as they go upward; audio starts at
  // A1 below the picture tracks.
  const number = track.type === "audio" ? position + 1 : sameType.length - position;
  return `${prefix}${number}`;
}

function buildLaneRows(tracks: TimelineTrack[]): LaneRow[] {
  const rows: LaneRow[] = [];
  const types: TrackType[] = ["media", "audio"];
  for (const type of types) {
    const group = tracks.filter((track) => track.type === type);
    const start = group.length ? tracks.indexOf(group[0]) : type === "media" ? 0 : tracks.length;
    const insertStart = start < 0 ? tracks.length : start;
    rows.push({ kind: "insert", type, index: insertStart, id: `${type}-before-${insertStart}` });
    for (const track of group) rows.push({ kind: "track", track });
    if (group.length) rows.push({ kind: "insert", type, index: insertStart + group.length, id: `${type}-after-${insertStart + group.length}` });
  }
  return rows;
}

function NewTrackLane({ row, active }: { row: Extract<LaneRow, { kind: "insert" }>; active: boolean }) {
  const label = row.type === "media" ? "visual" : "audio";
  return <div data-insert-type={row.type} data-insert-index={row.index} className={`relative border-b ${active ? "border-[#76a6cf] bg-[#e7f1fa]" : "border-[#d8d5d0] bg-[#e5e4e1]"}`} style={{ height: INSERT_H }}>
    {active && <span className="absolute inset-x-0 -top-px text-center text-[8px] font-semibold uppercase tracking-[.08em] text-[#4e86b7]">Drop to add {label} track</span>}
  </div>;
}

function ClipContextMenu({ menu, onAction }: { menu: Exclude<ClipContextMenu, null>; onAction: (action: "delete" | "copy" | "copy-id" | "cut" | "inspector", elementId: string) => void }) {
  const items: Array<["cut" | "copy" | "copy-id" | "inspector" | "delete", string, string]> = [["cut", "Cut", "✂"], ["copy", "Copy", "▣"], ["copy-id", "Copy element ID", "#"], ["inspector", "Open inspector", "◫"], ["delete", "Delete", "⌫"]];
  return <div role="menu" aria-label={`Actions for ${menu.name}`} onPointerDown={(event) => event.stopPropagation()} className="fixed z-[110] w-44 overflow-hidden border border-[#c9c7c2] bg-[#f7f6f4] py-1 shadow-[0_8px_22px_rgba(0,0,0,.18)]" style={{ left: menu.x, top: menu.y }}>
    {items.map(([action, label, icon]) => <button key={action} type="button" role="menuitem" onClick={() => onAction(action, menu.elementId)} className={`flex w-full items-center gap-3 px-3 py-2 text-left text-[12px] hover:bg-[#e7e4df] ${action === "delete" ? "text-[#bb3c32]" : "text-[#3f3b36]"}`}><span className="w-4 text-center text-[14px]">{icon}</span>{label}</button>)}
  </div>;
}

function AssetGhost({ x, y, thumb, name }: { x: number; y: number; thumb?: string; name?: string }) {
  return (
    <div className="pointer-events-none fixed z-[100] w-40 overflow-hidden rounded-lg border border-blue-400 bg-white opacity-90 shadow-xl" style={{ left: x + 8, top: y + 8 }}>
      <div className="aspect-video bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {thumb && <img src={thumb} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="truncate px-2 py-1 text-[11px] text-slate-500">{name}</div>
    </div>
  );
}
