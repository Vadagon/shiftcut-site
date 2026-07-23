import { Audio, Video } from "@remotion/media";
import { AbsoluteFill, Img, Sequence, useCurrentFrame } from "remotion";
import { GeneratedComponentRuntime } from "@/components/generated-component-runtime";
import { effectiveDuration, type TimelineElement, type TimelineTrack } from "@/types/timeline";
import type { RenderManifest } from "./types";

export interface ShiftCutCompositionProps extends Record<string, unknown> {
  manifest: RenderManifest;
}

export function ShiftCutComposition({ manifest }: ShiftCutCompositionProps) {
  const { fps, background = "#000000" } = manifest.project.settings;
  const visualTracks = manifest.tracks.filter((track) => track.type !== "audio");
  const audioTracks = manifest.tracks.filter((track) => track.type === "audio");

  return <AbsoluteFill style={{ backgroundColor: background, overflow: "hidden" }}>
    {[...visualTracks].reverse().map((track) => <Track key={track.id} track={track} manifest={manifest} fps={fps} />)}
    {audioTracks.map((track) => <Track key={track.id} track={track} manifest={manifest} fps={fps} />)}
  </AbsoluteFill>;
}

function Track({ track, manifest, fps }: { track: TimelineTrack; manifest: RenderManifest; fps: number }) {
  return <>{track.elements.map((element) => {
    const elementStart = Math.round(element.startTime * fps);
    const elementEnd = elementStart + Math.max(1, Math.round(effectiveDuration(element) * fps));
    const visibleStart = Math.max(elementStart, manifest.range.startFrame);
    const visibleEnd = Math.min(elementEnd, manifest.range.endFrame);
    if (visibleEnd <= visibleStart) return null;
    const from = visibleStart - manifest.range.startFrame;
    const durationInFrames = visibleEnd - visibleStart;
    const clippedHeadFrames = Math.max(0, visibleStart - elementStart);
    return <Sequence key={element.id} from={from} durationInFrames={durationInFrames} layout="none">
      <Element element={element} track={track} manifest={manifest} fps={fps} clippedHeadFrames={clippedHeadFrames} />
    </Sequence>;
  })}</>;
}

function Element({ element, track, manifest, fps, clippedHeadFrames }: { element: TimelineElement; track: TimelineTrack; manifest: RenderManifest; fps: number; clippedHeadFrames: number }) {
  const frame = useCurrentFrame();
  const asset = element.mediaId ? manifest.assets[element.mediaId] : undefined;
  const volume = track.muted ? 0 : clamp(numberParam(element.params.volume, 1), 0, 1);
  const trimBefore = Math.max(0, Math.round(element.trimStart * fps) + clippedHeadFrames);
  const trimAfter = asset?.duration
    ? Math.max(trimBefore + 1, Math.round((asset.duration - element.trimEnd) * fps))
    : undefined;

  if (element.component === "AudioPlayer" || track.type === "audio") {
    return asset ? <Audio src={asset.url} trimBefore={trimBefore} trimAfter={trimAfter} volume={volume} muted={volume === 0} /> : null;
  }

  if (track.hidden) {
    if (asset?.kind === "video" && volume > 0) return <Audio src={asset.url} trimBefore={trimBefore} trimAfter={trimAfter} volume={volume} />;
    return null;
  }

  if (element.component === "GeneratedReactComponent") {
    const artifact = element.componentId ? manifest.components[element.componentId] : undefined;
    if (!artifact) return null;
    return <AbsoluteFill style={{ zIndex: numberParam(element.params.zIndex, 0) }}>
      <GeneratedComponentRuntime code={artifact.code} props={{
        ...element.params,
        localTime: (frame + clippedHeadFrames) / fps,
        duration: effectiveDuration(element),
        canvasWidth: manifest.project.settings.width,
        canvasHeight: manifest.project.settings.height,
      }} />
    </AbsoluteFill>;
  }

  const params = element.params;
  const scaleX = numberParam(params.scaleX, params.scale);
  const scaleY = numberParam(params.scaleY, params.scale);
  const layerStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    transform: `translate(${params.x}px, ${params.y}px) scale(${scaleX}, ${scaleY}) rotate(${params.rotation}deg)`,
    transformOrigin: "center",
    opacity: clamp(params.opacity, 0, 1),
    filter: params.filter === "grayscale" ? "grayscale(1)" : undefined,
    zIndex: numberParam(params.zIndex, 0),
  };

  if (asset?.kind === "video") {
    return <Video src={asset.url} trimBefore={trimBefore} trimAfter={trimAfter} volume={volume} muted={volume === 0} style={{ ...layerStyle, width: "100%", height: "100%", objectFit: "contain" }} />;
  }
  if (asset?.kind === "image") {
    return <Img src={asset.url} style={{ ...layerStyle, width: "100%", height: "100%", objectFit: "contain" }} />;
  }

  return <div style={{ ...layerStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <span style={{
      color: stringParam(params.color, "#ffffff"),
      fontSize: numberParam(params.fontSize, 48),
      whiteSpace: "pre-wrap",
      textAlign: "center",
    }}>{stringParam(params.text, element.name || "Text")}</span>
  </div>;
}

function numberParam(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringParam(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
