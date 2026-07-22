// Import a File: probe metadata + generate a thumbnail. Returns metadata + blob
// for the storage service to persist (IndexedDB meta + OPFS binary).

import { uid } from "./utils";
import type { MediaFileData } from "./storage/types";

function kindFromMime(mime: string): MediaFileData["kind"] {
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "image";
}

async function probeVideo(url: string) {
  return new Promise<Partial<MediaFileData>>((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.src = url;
    const done = (thumb?: string) =>
      resolve({ duration: v.duration || 0, width: v.videoWidth || 0, height: v.videoHeight || 0, thumb });
    v.onloadeddata = () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 3); };
    v.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        const w = 240;
        const scale = w / (v.videoWidth || w);
        canvas.width = w;
        canvas.height = Math.round((v.videoHeight || w) * scale) || 135;
        canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
        done(canvas.toDataURL("image/jpeg", 0.6));
      } catch { done(); }
    };
    v.onerror = () => resolve({ duration: 0 });
  });
}

async function probeImage(url: string) {
  return new Promise<Partial<MediaFileData>>((resolve) => {
    const img = new Image();
    img.onload = () => {
      // A blob: URL only lives for this import operation and is revoked below.
      // Persist a compact data URL instead so the thumbnail survives reloads.
      try {
        const maxWidth = 320;
        const scale = Math.min(1, maxWidth / Math.max(1, img.naturalWidth));
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
        resolve({ width: img.naturalWidth, height: img.naturalHeight, thumb: canvas.toDataURL("image/jpeg", 0.78) });
      } catch {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      }
    };
    img.onerror = () => resolve({});
    img.src = url;
  });
}

export async function processFile(file: File): Promise<{ meta: MediaFileData; blob: Blob }> {
  const kind = kindFromMime(file.type || "");
  const url = URL.createObjectURL(file);
  let extra: Partial<MediaFileData> = {};
  try {
    if (kind === "video") extra = await probeVideo(url);
    else if (kind === "image") extra = await probeImage(url);
    else {
      const a = document.createElement("audio");
      a.preload = "metadata";
      a.src = url;
      await new Promise((r) => { a.onloadedmetadata = () => r(null); a.onerror = () => r(null); });
      extra = { duration: a.duration || 0 };
    }
  } finally {
    URL.revokeObjectURL(url);
  }
  const meta: MediaFileData = {
    id: uid("media"),
    name: file.name,
    kind,
    mime: file.type || "application/octet-stream",
    size: file.size,
    createdAt: Date.now(),
    ...extra,
  };
  return { meta, blob: file };
}
