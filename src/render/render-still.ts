import { renderStillOnWeb } from "@remotion/web-renderer";
import { ShiftCutComposition, type ShiftCutCompositionProps } from "./shiftcut-composition";
import type { RenderManifest } from "./types";

export async function renderStillLocally(manifest: RenderManifest, second: number): Promise<Blob> {
  const frame = Math.max(0, Math.min(manifest.durationInFrames - 1, Math.round(second * manifest.project.settings.fps)));
  const props: ShiftCutCompositionProps = { manifest };
  const result = await renderStillOnWeb({
    composition: {
      id: "ShiftCutMcpStill",
      component: ShiftCutComposition,
      width: manifest.project.settings.width,
      height: manifest.project.settings.height,
      fps: manifest.project.settings.fps,
      durationInFrames: manifest.durationInFrames,
      defaultProps: props,
    },
    inputProps: props,
    frame,
    scale: 1,
    licenseKey: process.env.NEXT_PUBLIC_REMOTION_LICENSE_KEY ?? "free-license",
    isProduction: process.env.NODE_ENV === "production",
  });
  return result.blob({ format: "png" });
}
