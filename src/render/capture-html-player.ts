"use client";

import { toBlob } from "html-to-image";

export async function captureHtmlPlayer(): Promise<Blob> {
  const node = document.querySelector<HTMLElement>("[data-shiftcut-html-player]");
  if (!node) throw new Error("The ShiftCut HTML player is not mounted.");
  const width = node.offsetWidth;
  const height = node.offsetHeight;
  if (!width || !height) throw new Error("The ShiftCut HTML player has no renderable size.");
  const blob = await toBlob(node, {
    width,
    height,
    canvasWidth: width,
    canvasHeight: height,
    pixelRatio: 1,
    cacheBust: false,
    skipAutoScale: true,
  });
  if (!blob) throw new Error("The browser could not capture the HTML player.");
  return blob;
}
