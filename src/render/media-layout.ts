import type { ElementParams } from "@/types/timeline";

export function getMediaLayout(params: ElementParams): {
  boxed: boolean;
  containerStyle: React.CSSProperties;
  mediaStyle: React.CSSProperties;
} {
  const width = finiteNumber(params.width);
  const height = finiteNumber(params.height);
  const boxed = width !== undefined && height !== undefined && width > 0 && height > 0;
  const scaleX = finiteNumber(params.scaleX) ?? finiteNumber(params.scale) ?? 1;
  const scaleY = finiteNumber(params.scaleY) ?? finiteNumber(params.scale) ?? 1;
  const rotation = finiteNumber(params.rotation) ?? 0;

  if (boxed) {
    const anchor = params.anchor === "center" ? "center" : "top-left";
    return {
      boxed: true,
      containerStyle: {
        position: "absolute",
        left: finiteNumber(params.x) ?? 0,
        top: finiteNumber(params.y) ?? 0,
        width,
        height,
        overflow: params.overflow === "visible" ? "visible" : "hidden",
        borderRadius: finiteNumber(params.borderRadius) ?? 0,
        border: (finiteNumber(params.borderWidth) ?? 0) > 0
          ? `${finiteNumber(params.borderWidth)}px solid ${typeof params.borderColor === "string" ? params.borderColor : "#ffffff"}`
          : undefined,
        boxShadow: typeof params.boxShadow === "string" ? params.boxShadow : undefined,
        boxSizing: "border-box",
        transform: `${anchor === "center" ? "translate(-50%, -50%) " : ""}scale(${scaleX}, ${scaleY}) rotate(${rotation}deg)`,
        transformOrigin: anchor === "center" ? "center" : "top left",
        opacity: clamp(finiteNumber(params.opacity) ?? 1, 0, 1),
        filter: params.filter === "grayscale" ? "grayscale(1)" : undefined,
        zIndex: finiteNumber(params.zIndex) ?? 0,
      },
      mediaStyle: {
        display: "block",
        width: "100%",
        height: "100%",
        objectFit: mediaFit(params.fit),
        objectPosition: typeof params.objectPosition === "string" ? params.objectPosition : "center",
      },
    };
  }

  return {
    boxed: false,
    containerStyle: {
      position: "absolute",
      inset: 0,
      transform: `translate(${finiteNumber(params.x) ?? 0}px, ${finiteNumber(params.y) ?? 0}px) scale(${scaleX}, ${scaleY}) rotate(${rotation}deg)`,
      transformOrigin: "center",
      opacity: clamp(finiteNumber(params.opacity) ?? 1, 0, 1),
      filter: params.filter === "grayscale" ? "grayscale(1)" : undefined,
      zIndex: finiteNumber(params.zIndex) ?? 0,
    },
    mediaStyle: {
      display: "block",
      width: "100%",
      height: "100%",
      objectFit: mediaFit(params.fit),
      objectPosition: typeof params.objectPosition === "string" ? params.objectPosition : "center",
    },
  };
}

function mediaFit(value: unknown): React.CSSProperties["objectFit"] {
  return value === "cover" || value === "fill" || value === "none" || value === "scale-down" ? value : "contain";
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
