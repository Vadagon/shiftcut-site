import { canRenderMediaOnWeb, renderMediaOnWeb } from "@remotion/web-renderer";
import { ShiftCutComposition, type ShiftCutCompositionProps } from "./shiftcut-composition";
import type { LocalExportOptions, RenderManifest } from "./types";

export async function renderLocally(manifest: RenderManifest, options: LocalExportOptions): Promise<Blob> {
  const width = makeEven(Math.round(manifest.project.settings.width * options.scale));
  const height = makeEven(Math.round(manifest.project.settings.height * options.scale));
  const compatibility = await canRenderMediaOnWeb({
    container: "mp4",
    videoCodec: "h264",
    audioCodec: options.includeAudio ? "aac" : null,
    width,
    height,
    muted: !options.includeAudio,
    videoBitrate: options.quality,
    outputTarget: "web-fs",
  });
  if (!compatibility.canRender) {
    const reason = compatibility.issues.filter((issue) => issue.severity === "error").map((issue) => issue.message).join(" ");
    throw new Error(reason || "This browser cannot render this MP4 locally.");
  }

  const props: ShiftCutCompositionProps = { manifest };
  const result = await renderMediaOnWeb({
    composition: {
      id: "ShiftCutLocalExport",
      component: ShiftCutComposition,
      width: manifest.project.settings.width,
      height: manifest.project.settings.height,
      fps: manifest.project.settings.fps,
      durationInFrames: manifest.durationInFrames,
      defaultProps: props,
    },
    inputProps: props,
    container: "mp4",
    videoCodec: "h264",
    audioCodec: options.includeAudio ? "aac" : null,
    videoBitrate: options.quality,
    audioBitrate: options.quality,
    muted: !options.includeAudio,
    scale: options.scale,
    signal: options.signal,
    outputTarget: "web-fs",
    licenseKey: process.env.NEXT_PUBLIC_REMOTION_LICENSE_KEY ?? "free-license",
    isProduction: process.env.NODE_ENV === "production",
    onProgress: ({ progress, encodedFrames, renderEstimatedTime }) => options.onProgress({ progress, encodedFrames, estimatedTimeMs: renderEstimatedTime }),
  });
  return result.getBlob();
}

function makeEven(value: number) {
  return Math.max(2, value % 2 === 0 ? value : value - 1);
}
