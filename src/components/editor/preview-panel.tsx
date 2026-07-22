"use client";

// HTML/DOM preview (ShiftCut renderer — NOT OpenCut's canvas). Composites the
// active elements at the current playback time. Each media element syncs a
// <video>/<img>; params drive the CSS transform.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProjectStore } from "@/stores/project-store";
import { usePlaybackStore } from "@/stores/playback-store";
import { useTimelineStore } from "@/stores/timeline-store";
import { useComponentStore } from "@/stores/component-store";
import { storageService } from "@/lib/storage/storage-service";
import { elementEnd, type TimelineElement } from "@/types/timeline";

export function PreviewPanel() {
  const project = useProjectStore((s) => s.activeProject);
  const tracks = useTimelineStore((s) => s.tracks);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const selectElement = useTimelineStore((s) => s.selectElement);
  const selectedId = useTimelineStore((s) => s.selectedElementId);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let frame = 0;
    const measure = () => {
      const next = { width: stage.clientWidth, height: stage.clientHeight };
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setStageSize(next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [project?.id]);
  if (!project) return null;

  const aspectRatio = project.settings.width / project.settings.height;
  const compositionScale = Math.min(
    stageSize.width > 0 ? stageSize.width / project.settings.width : 1,
    stageSize.height > 0 ? stageSize.height / project.settings.height : 1,
  );

  const active: { el: TimelineElement; hidden: boolean; trackOrder: number }[] = [];
  for (const [trackOrder, t] of tracks.entries()) {
    for (const el of t.elements) {
      if (currentTime >= el.startTime && currentTime < elementEnd(el)) active.push({ el, hidden: t.hidden, trackOrder });
    }
  }
  // DOM items rendered later are on top. Track order is the primary visual
  // stacking rule: top timeline lanes render over lower lanes; zIndex only
  // decides the order inside one track.
  active.sort((a, b) => (b.trackOrder - a.trackOrder) || Number(a.el.params.zIndex) - Number(b.el.params.zIndex));

  // Keep the reference viewer's vertical default while respecting the project's
  // actual aspect-ratio setting as soon as the user changes it.
  const stageStyle: React.CSSProperties =
    aspectRatio < 1
      ? { aspectRatio, height: "min(100%, 416px)", maxWidth: "100%" }
      : { aspectRatio, width: "min(100%, 740px)", maxHeight: "100%" };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#edebe8]">
      <div className="h-10 shrink-0 border-b border-[#c9c7c2] px-4 py-3 text-[13px] font-semibold tracking-[.02em] text-[#292724]">VIEWER</div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        <div ref={stageRef} className="relative overflow-hidden bg-black shadow-[0_1px_3px_rgba(0,0,0,.25)]" style={{ ...stageStyle, background: project.settings.background ?? "#000" }}>
          {active.length === 0 && <div className="flex h-full items-center justify-center text-sm text-slate-400">Drag an asset onto the timeline</div>}
          <div className="absolute left-1/2 top-1/2" style={{ width: project.settings.width, height: project.settings.height, transform: `translate(-50%, -50%) scale(${compositionScale})`, transformOrigin: "center" }}>
            {active.map(({ el, hidden }) => hidden ? null : (
              <Layer key={el.id} el={el} time={currentTime} playing={isPlaying} selected={selectedId === el.id} onSelect={() => selectElement(el.id)} canvas={project.settings} />
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

function useMediaUrl(mediaId?: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoke: string | null = null;
    if (mediaId) storageService.getMediaUrl(mediaId).then((u) => { revoke = u; setUrl(u); });
    else queueMicrotask(() => setUrl(null));
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [mediaId]);
  return url;
}

function Layer({ el, time, playing, selected, onSelect, canvas }: { el: TimelineElement; time: number; playing: boolean; selected: boolean; onSelect: () => void; canvas: { width: number; height: number } }) {
  const artifact = useComponentStore((state) => el.componentId ? state.components[el.componentId] : undefined);
  const p = el.params;
  const sx = (p.scaleX as number) ?? p.scale;
  const sy = (p.scaleY as number) ?? p.scale;
  const style: React.CSSProperties = {
    position: "absolute", inset: 0,
    transform: `translate(${p.x}px, ${p.y}px) scale(${sx}, ${sy}) rotate(${p.rotation}deg)`,
    opacity: p.opacity,
    filter: p.filter === "grayscale" ? "grayscale(1)" : undefined,
    outline: selected ? "2px solid #2563eb" : "none",
    outlineOffset: -2,
  };
  if (el.type === "text") {
    if (el.component === "GeneratedReactComponent" && artifact) {
      const generatedStyle: React.CSSProperties = {
        position: "absolute", inset: 0,
        outline: selected ? "2px solid #2563eb" : "none",
        outlineOffset: -2,
      };
      return <GeneratedComponentLayer el={el} code={artifact.code} time={time} style={generatedStyle} onSelect={onSelect} canvas={canvas} />;
    }
    return <div style={style} onMouseDown={onSelect} className="flex items-center justify-center"><span style={{ color: (p.color as string) ?? "#fff", fontSize: (p.fontSize as number) ?? 48 }}>{(p.text as string) ?? "Text"}</span></div>;
  }
  if (el.component === "ImagePlayer") return <ImageLayer el={el} style={style} onSelect={onSelect} />;
  if (el.component === "AudioPlayer") return <AudioLayer el={el} time={time} playing={playing} />;
  return <VideoLayer el={el} time={time} playing={playing} style={style} onSelect={onSelect} />;
}

function GeneratedComponentLayer({ el, code, time, style, onSelect, canvas }: { el: TimelineElement; code: string; time: number; style: React.CSSProperties; onSelect: () => void; canvas: { width: number; height: number } }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const staticProps = useMemo(() => ({ ...el.params, canvasWidth: canvas.width, canvasHeight: canvas.height }), [el.params, canvas.width, canvas.height]);
  const source = useMemo(() => makeComponentDocument(el.component, code, staticProps, canvas), [el.component, code, staticProps, canvas]);
  const localTime = Math.max(0, time - el.startTime);
  const duration = elementEnd(el) - el.startTime;
  const postTimelineTime = useCallback(() => iframeRef.current?.contentWindow?.postMessage({ type: "shiftcut:timeline-time", props: { localTime, duration } }, "*"), [localTime, duration]);
  useEffect(() => {
    postTimelineTime();
  }, [postTimelineTime]);
  return <iframe ref={iframeRef} title={el.name} sandbox="allow-scripts" srcDoc={source} onLoad={postTimelineTime} onMouseDown={onSelect} style={style} className="h-full w-full border-0 bg-transparent" />;
}

function makeComponentDocument(name: string, code: string, props: Record<string, unknown>, canvas: { width: number; height: number }) {
  const safeCode = code.replace(/<\/script/gi, "<\\/script");
  const safeProps = JSON.stringify(props).replace(/</g, "\\u003c");
  const safeName = JSON.stringify(name);
  const safeCanvas = JSON.stringify(canvas);
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}#root{width:${canvas.width}px;height:${canvas.height}px}</style></head><body><div id="root"></div><script src="https://unpkg.com/react@18/umd/react.production.min.js"></script><script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script><script>${safeCode}\ntry { const canvas = ${safeCanvas}; const root = document.getElementById('root'); root.style.width = canvas.width + 'px'; root.style.height = canvas.height + 'px'; const Component = window[${safeName}] || GeneratedComponent; let props = ${safeProps}; const reactRoot = ReactDOM.createRoot(root); const render = () => reactRoot.render(React.createElement(Component, props)); window.addEventListener('message', (event) => { if (event.data?.type === 'shiftcut:timeline-time') { props = { ...props, ...event.data.props }; render(); } }); render(); } catch (error) { document.getElementById('root').textContent = 'Component preview unavailable'; }</script></body></html>`;
}

function VideoLayer({ el, time, playing, style, onSelect }: { el: TimelineElement; time: number; playing: boolean; style: React.CSSProperties; onSelect: () => void }) {
  const url = useMediaUrl(el.mediaId);
  const ref = useRef<HTMLVideoElement>(null);
  const local = time - el.startTime + el.trimStart;
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (playing) { if (Math.abs(v.currentTime - local) > 0.3) v.currentTime = local; v.play().catch(() => {}); }
    else { v.pause(); v.currentTime = local; }
  }, [playing, local]);
  const volume = typeof el.params.volume === "number" ? Math.max(0, Math.min(1, el.params.volume)) : 1;
  useEffect(() => { if (ref.current) ref.current.volume = volume; }, [volume]);
  return <video ref={ref} src={url ?? undefined} muted={volume === 0} onMouseDown={onSelect} style={style} className="h-full w-full object-contain" />;
}

function ImageLayer({ el, style, onSelect }: { el: TimelineElement; style: React.CSSProperties; onSelect: () => void }) {
  const url = useMediaUrl(el.mediaId);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url ?? undefined} alt="" style={style} onMouseDown={onSelect} className="h-full w-full object-contain" />;
}

function AudioLayer({ el, time, playing }: { el: TimelineElement; time: number; playing: boolean }) {
  const url = useMediaUrl(el.mediaId);
  const ref = useRef<HTMLAudioElement>(null);
  const local = time - el.startTime + el.trimStart;
  const volume = typeof el.params.volume === "number" ? Math.max(0, Math.min(1, el.params.volume)) : 1;
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    audio.volume = volume;
    if (playing) { if (Math.abs(audio.currentTime - local) > 0.3) audio.currentTime = local; audio.play().catch(() => {}); }
    else { audio.pause(); audio.currentTime = local; }
  }, [playing, local, volume]);
  return <audio ref={ref} src={url ?? undefined} />;
}
