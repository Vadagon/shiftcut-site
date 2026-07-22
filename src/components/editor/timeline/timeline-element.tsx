"use client";

// Presentational timeline clip. Positioned by startTime; width from effective
// duration. Filmstrip = tiled thumbnail. Adapted from OpenCut (MIT, /NOTICE).

import { useEffect, useMemo, useState } from "react";
import { useMediaStore } from "@/stores/media-store";
import { storageService } from "@/lib/storage/storage-service";
import type { MediaFileData } from "@/lib/storage/types";
import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";
import { cn } from "@/lib/utils";
import { effectiveDuration, type TimelineElement as TEl } from "@/types/timeline";

export function TimelineElement({
  element, pxPerSec, selected, liveStart, liveEnd, onMoveDown, onTrimDown, onContextMenu,
}: {
  element: TEl;
  pxPerSec: number;
  selected: boolean;
  liveStart?: number;
  liveEnd?: number;
  onMoveDown: (e: React.PointerEvent) => void;
  onTrimDown: (e: React.PointerEvent, side: "left" | "right") => void;
  onContextMenu: (e: React.MouseEvent, element: TEl) => void;
}) {
  const pool = useMediaStore((s) => s.pool);
  const media = useMemo(() => (element.mediaId ? pool.find((m) => m.id === element.mediaId) : undefined), [pool, element.mediaId]);
  const thumbnail = useTimelineThumbnail(media);
  const start = liveStart ?? element.startTime;
  const end = liveEnd ?? start + effectiveDuration(element);
  const left = start * pxPerSec;
  const width = Math.max(TIMELINE_CONSTANTS.ELEMENT_MIN_WIDTH, (end - start) * pxPerSec);
  const gray = element.params.filter === "grayscale";
  const dragging = liveStart != null || liveEnd != null;
  const isVideo = media?.kind === "video";
  const isAudio = media?.kind === "audio";

  return (
    <div
      onPointerDown={onMoveDown}
      onContextMenu={(event) => onContextMenu(event, element)}
      className={cn(
        "group absolute top-1 flex h-[calc(100%-8px)] cursor-grab overflow-hidden rounded-[5px] border-2",
        dragging && "z-50 opacity-90 shadow-lg",
        element.type === "text" ? "border-[#713853] bg-[linear-gradient(45deg,#f1eff0_25%,#e5e1e3_25%,#e5e1e3_50%,#f1eff0_50%,#f1eff0_75%,#e5e1e3_75%)] bg-[length:16px_16px]" : isAudio ? "border-[#2d6243] bg-[#659576]" : isVideo ? "border-[#153c5a] bg-[#5b95c5]" : "border-[#235a84] bg-[#5b95c5]",
        selected ? "ring-2 ring-[#e5793f]" : "",
      )}
      style={{ left, width }}
      data-element-id={element.id}
    >
      {thumbnail && element.type !== "text" && media?.kind !== "audio" ? (
        <div className={cn("absolute left-0 right-0 top-0", isVideo ? "h-[46%]" : "bottom-0")} style={{ backgroundImage: `url(${thumbnail})`, backgroundSize: "auto 100%", backgroundRepeat: "repeat-x", filter: gray ? "grayscale(1)" : undefined }} />
      ) : (
        <div className={cn("absolute inset-0", element.type === "text" ? "bg-transparent" : isAudio ? "bg-[#659576]" : "bg-[#5b95c5]")} />
      )}
      {(isVideo || isAudio) && <Waveform mediaId={element.mediaId} fallbackId={element.id} volume={typeof element.params.volume === "number" ? element.params.volume : 1} tone={isAudio ? "audio" : "video"} />}
      <span className={cn("pointer-events-none absolute z-10 truncate font-semibold", element.type === "text" ? "bottom-0 left-0 max-w-full bg-[#af5a87] px-1.5 py-0.5 text-[10px] text-[#21131c]" : isVideo ? "bottom-[34%] left-0 flex h-[20%] w-full items-center bg-[#5b95c5] px-2 text-[11px] text-[#102536]" : isAudio ? "bottom-0 left-1.5 max-w-[calc(100%-12px)] py-1 text-[11px] text-[#102d1b]" : "left-1.5 top-1 rounded bg-black/45 px-1.5 py-0.5 text-[10px] text-white")}>{element.name}</span>
      <div onPointerDown={(e) => onTrimDown(e, "left")} className="absolute left-0 top-0 z-20 h-full w-2 cursor-ew-resize hover:bg-white/50" />
      <div onPointerDown={(e) => onTrimDown(e, "right")} className="absolute right-0 top-0 z-20 h-full w-2 cursor-ew-resize hover:bg-white/50" />
    </div>
  );
}

function Waveform({ mediaId, fallbackId, volume, tone }: { mediaId?: string; fallbackId: string; volume: number; tone: "video" | "audio" }) {
  const values = useDecodedWaveform(mediaId, fallbackId);
  const amplitude = Math.max(0.08, Math.min(1, volume)) * 16;
  const stroke = tone === "audio" ? "#174729" : "#1f5637";
  const fill = tone === "audio" ? "rgba(24,77,43,.78)" : "rgba(50,133,77,.78)";
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${24 - value * amplitude}`).join(" ");
  const mirrored = [...values].reverse().map((value, index) => `${100 - (index / (values.length - 1)) * 100},${24 + value * amplitude}`).join(" ");
  return <svg aria-label={`Waveform at ${Math.round(volume * 100)} percent volume`} className={cn("pointer-events-none absolute inset-x-0 bottom-0 z-[1] w-full", tone === "video" ? "h-[42%]" : "h-full")} viewBox="0 0 100 48" preserveAspectRatio="none">
    <polygon points={`${points} ${mirrored}`} fill={fill} opacity={volume === 0 ? 0.28 : 1} />
    <line x1="0" x2="100" y1="24" y2="24" stroke="rgba(8,34,20,.65)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
    <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.1" vectorEffect="non-scaling-stroke" />
  </svg>;
}

const waveformCache = new Map<string, number[]>();

function useDecodedWaveform(mediaId: string | undefined, fallbackId: string) {
  const [values, setValues] = useState<number[]>(() => waveformValues(fallbackId));
  useEffect(() => {
    let disposed = false;
    if (!mediaId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset derived waveform when the clip source changes.
      setValues(waveformValues(fallbackId));
      return;
    }
    const cached = waveformCache.get(mediaId);
    if (cached) {
      setValues(cached);
      return;
    }
    void decodeWaveform(mediaId).then((next) => {
      if (disposed) return;
      const waveform = next ?? waveformValues(fallbackId);
      waveformCache.set(mediaId, waveform);
      setValues(waveform);
    });
    return () => { disposed = true; };
  }, [mediaId, fallbackId]);
  return values;
}

async function decodeWaveform(mediaId: string): Promise<number[] | null> {
  try {
    const blob = await storageService.getMediaBlob(mediaId);
    if (!blob || typeof AudioContext === "undefined") return null;
    const context = new AudioContext();
    const audio = await context.decodeAudioData(await blob.arrayBuffer());
    const bins = 96;
    const step = Math.max(1, Math.floor(audio.length / bins));
    const values = Array.from({ length: bins }, (_, bin) => {
      const start = bin * step;
      const end = Math.min(audio.length, start + step);
      let peak = 0;
      for (let channel = 0; channel < audio.numberOfChannels; channel += 1) {
        const data = audio.getChannelData(channel);
        for (let sample = start; sample < end; sample += 16) peak = Math.max(peak, Math.abs(data[sample] ?? 0));
      }
      return peak;
    });
    await context.close();
    const max = Math.max(...values, 0.001);
    return values.map((value) => Math.max(0.08, Math.min(1, value / max)));
  } catch {
    return null;
  }
}

function waveformValues(seed: string) {
  let value = 0;
  for (const char of seed) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return Array.from({ length: 64 }, () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return 0.22 + ((value >>> 8) % 78) / 100;
  });
}

function useTimelineThumbnail(media?: MediaFileData) {
  const [thumbnail, setThumbnail] = useState<string | undefined>(media?.thumb);

  useEffect(() => {
    let objectUrl: string | null = null;
    let disposed = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the asynchronous OPFS fallback when the asset changes.
    setThumbnail(media?.thumb);

    // Older image metadata can contain a revoked blob: thumbnail. Read the
    // original binary from OPFS for a durable timeline filmstrip instead.
    if (media?.kind === "image") {
      void storageService.getMediaUrl(media.id).then((url) => {
        if (disposed) { if (url) URL.revokeObjectURL(url); return; }
        objectUrl = url;
        if (url) setThumbnail(url);
      });
    }
    return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [media?.id, media?.kind, media?.thumb]);

  return thumbnail;
}
