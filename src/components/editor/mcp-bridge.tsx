"use client";

import { useEffect } from "react";
import { storageService } from "@/lib/storage/storage-service";
import { serializeCompactProject } from "@/lib/composition-dsl";
import { parseEditorTransaction, simulateTransaction } from "@/lib/ai-transaction-protocol";
import { useProjectStore } from "@/stores/project-store";
import { useTimelineStore } from "@/stores/timeline-store";
import { useMediaStore } from "@/stores/media-store";
import { useComponentStore } from "@/stores/component-store";
import { createRenderManifest } from "@/render/create-render-manifest";
import { renderLocally } from "@/render/local-render";
import { renderStillLocally } from "@/render/render-still";
import { validateGeneratedComponent } from "@/components/generated-component-runtime";
import { captureHtmlPlayer } from "@/render/capture-html-player";
import { usePlaybackStore } from "@/stores/playback-store";

const BRIDGE_URL = process.env.NEXT_PUBLIC_SHIFTCUT_MCP_BRIDGE_URL ?? "ws://127.0.0.1:43891";

type BridgeRequest = { id: string; method: string; params?: Record<string, unknown> };

export function McpBridge() {
  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    let manuallyDisconnected = false;

    const connect = () => {
      if (stopped || manuallyDisconnected || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
      socket = new WebSocket(BRIDGE_URL);
      socket.addEventListener("open", () => {
        window.dispatchEvent(new CustomEvent("shiftcut:mcp-status", { detail: { connected: true } }));
        socket?.send(JSON.stringify({ type: "hello", client: "shiftcut-editor", projectId: useProjectStore.getState().activeProject?.id ?? null }));
      });
      socket.addEventListener("message", (event) => {
        void handleBridgeRequest(JSON.parse(String(event.data)) as BridgeRequest)
          .then((result) => socket?.send(JSON.stringify({ id: JSON.parse(String(event.data)).id, result })))
          .catch((error) => socket?.send(JSON.stringify({ id: JSON.parse(String(event.data)).id, error: error instanceof Error ? error.message : "MCP command failed." })));
      });
      socket.addEventListener("close", () => {
        window.dispatchEvent(new CustomEvent("shiftcut:mcp-status", { detail: { connected: false } }));
        socket = null;
        if (!stopped && !manuallyDisconnected) retry = setTimeout(connect, 1500);
      });
    };
    const disconnect = () => {
      manuallyDisconnected = true;
      if (retry) {
        clearTimeout(retry);
        retry = null;
      }
      socket?.close(1000, "Disconnected by editor user");
      socket = null;
      window.dispatchEvent(new CustomEvent("shiftcut:mcp-status", { detail: { connected: false } }));
    };
    const reconnect = () => {
      manuallyDisconnected = false;
      connect();
    };
    window.addEventListener("shiftcut:mcp-disconnect", disconnect);
    window.addEventListener("shiftcut:mcp-reconnect", reconnect);
    connect();
    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      socket?.close();
      window.removeEventListener("shiftcut:mcp-disconnect", disconnect);
      window.removeEventListener("shiftcut:mcp-reconnect", reconnect);
      window.dispatchEvent(new CustomEvent("shiftcut:mcp-status", { detail: { connected: false } }));
    };
  }, []);
  return null;
}

async function handleBridgeRequest(request: BridgeRequest) {
  const project = useProjectStore.getState().activeProject;
  if (!project) throw new Error("No ShiftCut project is open.");
  const timeline = useTimelineStore.getState();
  const { media, components } = await hydrateProjectContext(project.id, timeline.tracks);
  const params = request.params ?? {};

  switch (request.method) {
    case "status":
      return { connected: true, projectId: project.id, projectName: project.name, revision: project.revision };
    case "get_revision":
      return { projectId: project.id, revision: project.revision };
    case "get_project":
      return {
        project,
        tracks: timeline.tracks,
        components: Object.values(components),
        assets: media.pool.filter((asset) => media.projectAssetIds.includes(asset.id)),
        composition: serializeCompactProject({ project, tracks: timeline.tracks, components, assets: media.pool }),
      };
    case "list_assets":
      return media.pool.filter((asset) => params.scope === "global" || media.projectAssetIds.includes(asset.id));
    case "apply_transaction": {
      const source = JSON.stringify(params.transaction);
      const transaction = parseEditorTransaction(source, project.revision);
      if (transaction.type !== "editor_transaction") throw new Error("MCP mutations require editor_transaction.");
      const simulation = simulateTransaction({ transaction, tracks: timeline.tracks, assets: media.pool, settings: project.settings });
      if (simulation.componentJobs.length) throw new Error("Use timeline operations only. MCP component source editing is not enabled in this build.");
      useProjectStore.getState().setSettingsForCommit(simulation.settings);
      useProjectStore.getState().setCompositionDescriptionForCommit(transaction.compositionDescription);
      timeline.replaceTimeline(simulation.tracks, `MCP: ${transaction.summary}`);
      return { revision: useProjectStore.getState().activeProject?.revision, summary: transaction.summary };
    }
    case "replace_component": {
      const expectedRevision = Number(params.expectedRevision);
      if (expectedRevision !== project.revision) throw new Error(`Revision mismatch: expected ${expectedRevision}, current ${project.revision}.`);
      const elementId = String(params.elementId ?? "");
      const found = timeline.findElement(elementId);
      if (!found?.element.componentId) throw new Error(`Element ${elementId} is not a generated component.`);
      const code = String(params.code ?? "");
      const compatibility = validateGeneratedComponent(code);
      if (!compatibility.compatible) throw new Error(`Component acceptance failed: ${compatibility.errors.join(" ")}`);
      const existing = components[found.element.componentId];
      if (!existing) throw new Error(`Component source ${found.element.componentId} is missing.`);
      const propsSchema = Array.isArray(params.propsSchema)
        ? params.propsSchema as typeof existing.propsSchema
        : existing.propsSchema;
      const artifact = useComponentStore.getState().upsert({
        name: typeof params.name === "string" && params.name.trim() ? params.name.trim() : existing.name,
        description: typeof params.description === "string" && params.description.trim() ? params.description.trim() : existing.description,
        code,
        propsSchema,
      }, existing.id);
      const nextTracks = timeline.tracks.map((track) => ({
        ...track,
        elements: track.elements.map((element) => element.id === elementId
          ? {
              ...element,
              componentId: artifact.id,
              componentVersion: artifact.version,
              ...(typeof params.elementDescription === "string" && params.elementDescription.trim() ? { description: params.elementDescription.trim() } : {}),
              ...(typeof params.purpose === "string" && params.purpose.trim() ? { purpose: params.purpose.trim() } : {}),
            }
          : element),
      }));
      useProjectStore.getState().setCompositionDescriptionForCommit(String(params.compositionDescription ?? project.compositionDescription ?? ""));
      timeline.replaceTimeline(nextTracks, typeof params.summary === "string" && params.summary.trim() ? params.summary.trim() : `MCP: updated ${found.element.name}`);
      return { revision: useProjectStore.getState().activeProject?.revision, componentId: artifact.id, componentVersion: artifact.version };
    }
    case "upload_assets": {
      const files = Array.isArray(params.files) ? params.files : [];
      const browserFiles = files.map((item) => {
        const file = item as { name: string; mime?: string; base64: string };
        return new File([base64ToBytes(file.base64)], file.name, { type: file.mime || "application/octet-stream" });
      });
      await media.importFiles(browserFiles);
      return { revision: useProjectStore.getState().activeProject?.revision, assets: useMediaStore.getState().projectAssetIds };
    }
    case "download_assets": {
      const requested = Array.isArray(params.assetIds) ? params.assetIds.map(String) : media.projectAssetIds;
      const files = [];
      for (const id of requested) {
        const asset = media.pool.find((item) => item.id === id);
        if (!asset) throw new Error(`Unknown asset ${id}.`);
        const blob = await storageService.getMediaBlob(id);
        if (!blob) throw new Error(`Asset file ${id} is missing.`);
        files.push({ id, name: asset.name, mime: asset.mime, base64: await blobToBase64(blob) });
      }
      return { files };
    }
    case "screenshot": {
      const second = Number(params.second ?? 0);
      const prepared = await createRenderManifest({ project, tracks: timeline.tracks, pool: media.pool, components, range: { start: 0, end: Math.max(timeline.getTotalDuration(), 1 / project.settings.fps) } });
      try {
        const blob = await renderStillLocally(prepared.manifest, second);
        return { mime: "image/png", second, base64: await blobToBase64(blob) };
      } finally {
        prepared.release();
      }
    }
    case "screenshot_player": {
      const second = Math.max(0, Number(params.second ?? 0));
      usePlaybackStore.getState().pause();
      usePlaybackStore.getState().seek(second);
      await waitForPlayerPaint();
      const blob = await captureHtmlPlayer();
      return { mime: "image/png", second, base64: await blobToBase64(blob) };
    }
    case "export_video": {
      const prepared = await createRenderManifest({ project, tracks: timeline.tracks, pool: media.pool, components });
      try {
        const blob = await renderLocally(prepared.manifest, {
          scale: Number(params.scale ?? 1),
          quality: params.quality === "low" || params.quality === "high" ? params.quality : "medium",
          includeAudio: params.includeAudio !== false,
          signal: new AbortController().signal,
          onProgress: () => {},
        });
        return { mime: "video/mp4", revision: project.revision, base64: await blobToBase64(blob) };
      } finally {
        prepared.release();
      }
    }
    default:
      throw new Error(`Unsupported MCP bridge method: ${request.method}`);
  }
}

async function waitForPlayerPaint() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  const videos = [...document.querySelectorAll<HTMLVideoElement>("[data-shiftcut-html-player] video")];
  await Promise.all(videos.map((video) => {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !video.seeking) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = () => resolve();
      video.addEventListener("seeked", done, { once: true });
      video.addEventListener("loadeddata", done, { once: true });
      setTimeout(done, 750);
    });
  }));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

async function hydrateProjectContext(projectId: string, tracks: ReturnType<typeof useTimelineStore.getState>["tracks"]) {
  const mediaStore = useMediaStore.getState();
  if (mediaStore._projectId !== projectId) await mediaStore.loadForProject(projectId);

  const componentStore = useComponentStore.getState();
  if (componentStore.projectId !== projectId) await componentStore.loadForProject(projectId);

  const liveComponents = useComponentStore.getState().components;
  const referencedIds = new Set(
    tracks.flatMap((track) => track.elements.flatMap((element) => element.componentId ? [element.componentId] : [])),
  );
  const missingIds = [...referencedIds].filter((id) => !liveComponents[id]);
  if (missingIds.length) {
    // A reconnect can race the editor's normal hydration. Read the durable
    // registry directly and merge it with newer in-memory artifacts instead
    // of replacing either source.
    const persisted = await storageService.loadComponents(projectId);
    const merged = {
      ...Object.fromEntries(persisted.map((component) => [component.id, component])),
      ...liveComponents,
    };
    const unresolved = missingIds.filter((id) => !merged[id]);
    if (unresolved.length) {
      throw new Error(`The timeline references missing component source: ${unresolved.join(", ")}.`);
    }
    return { media: useMediaStore.getState(), components: merged };
  }

  return { media: useMediaStore.getState(), components: liveComponents };
}

async function blobToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
