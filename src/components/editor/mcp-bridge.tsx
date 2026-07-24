"use client";

import { useEffect, useRef } from "react";
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

type BridgeRequest = { id: string; method: string; params?: Record<string, unknown> };
export type McpConnectionState = "unavailable" | "bridge_ready" | "approval_required" | "connected" | "error";
export type McpStatusDetail = {
  state: McpConnectionState;
  connected: boolean;
  agentName?: string;
  agentVersion?: string;
  error?: string;
  mcpUrl?: string;
  pairingCode?: string;
};

type RelaySession = {
  approved: boolean;
  agentName?: string;
  agentVersion?: string;
};
type StoredMcpSession = { token?: unknown; pairingCode?: unknown; expiresAt?: unknown };

const MUTATING_METHODS = new Set(["apply_transaction", "replace_component", "upload_assets"]);
let mutationQueue: Promise<void> = Promise.resolve();

function dispatchStatus(detail: Omit<McpStatusDetail, "connected"> & { connected?: boolean }) {
  window.dispatchEvent(new CustomEvent<McpStatusDetail>("shiftcut:mcp-status", {
    detail: { ...detail, connected: detail.connected ?? detail.state === "connected" },
  }));
}

export function McpBridge({ projectId, projectName }: { projectId: string; projectName: string }) {
  const projectNameRef = useRef(projectName);
  useEffect(() => {
    projectNameRef.current = projectName;
  }, [projectName]);
  useEffect(() => {
    let stopped = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    const storageKey = `shiftcut:mcp-session:${projectId}`;
    let token = "";
    let pairingCode = "";
    let mcpUrl = "";

    const postSession = async (body: Record<string, unknown>, targetToken = token) => {
      const response = await fetch("/api/mcp/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: targetToken, ...body }),
      });
      if (!response.ok) throw new Error((await response.json() as { error?: string }).error ?? "MCP session request failed.");
    };

    const publishStatus = (session?: RelaySession) => {
      dispatchStatus({
        state: session?.approved && session.agentName ? "connected" : "bridge_ready",
        agentName: session?.agentName,
        agentVersion: session?.agentVersion,
        mcpUrl,
        pairingCode,
      });
    };

    const poll = async () => {
      if (stopped || !token) return;
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = null;
      const activeToken = token;
      try {
        const response = await fetch(`/api/mcp/session?token=${encodeURIComponent(activeToken)}`, { cache: "no-store" });
        if (!response.ok) throw new Error((await response.json() as { error?: string }).error ?? "MCP session expired.");
        const body = await response.json() as { session: RelaySession; command?: BridgeRequest | null };
        if (activeToken !== token) return;
        publishStatus(body.session);
        if (body.command) {
          try {
            const result = await scheduleBridgeRequest(body.command);
            await postSession({ action: "result", commandId: body.command.id, result }, activeToken);
          } catch (error) {
            await postSession({ action: "result", commandId: body.command.id, error: error instanceof Error ? error.message : "MCP command failed." }, activeToken);
          }
        }
      } catch (error) {
        dispatchStatus({ state: "error", error: error instanceof Error ? error.message : "Could not reach the MCP relay.", mcpUrl, pairingCode });
      }
      if (!stopped && activeToken === token) pollTimer = setTimeout(poll, 750);
    };

    const startSession = async (forceNew = false) => {
      if (pollTimer) clearTimeout(pollTimer);
      let saved: StoredMcpSession | null = null;
      if (!forceNew) {
        try {
          saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null") as StoredMcpSession | null;
        } catch {
          sessionStorage.removeItem(storageKey);
        }
      }
      const savedExpired = typeof saved?.expiresAt === "number" && saved.expiresAt <= Date.now();
      if (savedExpired) {
        sessionStorage.removeItem(storageKey);
        saved = null;
      }
      if (typeof saved?.token === "string" && typeof saved.pairingCode === "string") {
        token = saved.token;
        pairingCode = saved.pairingCode;
      } else {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        pairingCode = `${token.slice(0, 4)}-${token.slice(4, 8)}`.toUpperCase();
        sessionStorage.setItem(storageKey, JSON.stringify({ token, pairingCode, expiresAt: Date.now() + 6 * 60 * 60 * 1000 }));
      }
      mcpUrl = `${window.location.origin}/api/mcp?token=${encodeURIComponent(token)}`;
      dispatchStatus({ state: "bridge_ready", mcpUrl, pairingCode });
      try {
        if (saved) {
          const existing = await fetch(`/api/mcp/session?token=${encodeURIComponent(token)}&status=1`, { cache: "no-store" });
          if (existing.ok) {
            await poll();
            return;
          }
          // A dev-server restart or serverless eviction can remove relay state.
          // Recreate it with the same capability URL so editor reloads never
          // silently invalidate an agent's saved connection.
          await postSession({ action: "create", pairingCode, projectId, projectName: projectNameRef.current });
          await poll();
          return;
        }
        await postSession({ action: "create", pairingCode, projectId, projectName: projectNameRef.current });
        await poll();
      } catch (error) {
        dispatchStatus({ state: "error", error: error instanceof Error ? error.message : "Could not create an MCP pairing link.", mcpUrl, pairingCode });
      }
    };

    const revoke = async () => {
      try {
        await postSession({ action: "revoke" });
      } finally {
        sessionStorage.removeItem(storageKey);
        await startSession(true);
      }
    };

    const reconnect = () => void startSession();
    const revokeEvent = () => void revoke();
    window.addEventListener("shiftcut:mcp-reconnect", reconnect);
    window.addEventListener("shiftcut:mcp-revoke", revokeEvent);
    void startSession();
    return () => {
      stopped = true;
      if (pollTimer) clearTimeout(pollTimer);
      window.removeEventListener("shiftcut:mcp-reconnect", reconnect);
      window.removeEventListener("shiftcut:mcp-revoke", revokeEvent);
      dispatchStatus({ state: "unavailable" });
    };
  }, [projectId]);
  return null;
}

function scheduleBridgeRequest(request: BridgeRequest) {
  if (!MUTATING_METHODS.has(request.method)) return handleBridgeRequest(request);
  const result = mutationQueue.then(() => handleBridgeRequest(request));
  mutationQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function handleBridgeRequest(request: BridgeRequest) {
  const projectBeforeHydration = useProjectStore.getState().activeProject;
  if (!projectBeforeHydration) throw new Error("No ShiftCut project is open.");
  const hydrated = await hydrateProjectContext(projectBeforeHydration.id, useTimelineStore.getState().tracks);
  const project = useProjectStore.getState().activeProject;
  if (!project || project.id !== projectBeforeHydration.id) throw new Error("The open ShiftCut project changed while preparing the MCP command.");
  const timeline = useTimelineStore.getState();
  const media = useMediaStore.getState();
  const components = hydrated.components;
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
