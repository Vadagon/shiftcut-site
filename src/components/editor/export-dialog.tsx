"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { storageService } from "@/lib/storage/storage-service";
import type { ComponentArtifact, MediaFileData, RenderJob, RenderJobSettings } from "@/lib/storage/types";
import { createRenderManifest } from "@/render/create-render-manifest";
import { renderLocally } from "@/render/local-render";
import type { ExportQuality, PreparedRenderManifest } from "@/render/types";
import type { TProject } from "@/types/project";
import { totalDuration, type TimelineTrack } from "@/types/timeline";
import { validateGeneratedComponent } from "@/components/generated-component-runtime";

type ExportStatus = "idle" | RenderJob["status"];

export function ExportDialog({ project, tracks, pool, components, onClose }: {
  project: TProject;
  tracks: TimelineTrack[];
  pool: MediaFileData[];
  components: Record<string, ComponentArtifact>;
  onClose: () => void;
}) {
  const timelineDuration = Math.max(1 / project.settings.fps, totalDuration(tracks));
  const incompatibleElements = useMemo(() => tracks.flatMap((track) => track.elements.flatMap((element) => {
    if (element.component !== "GeneratedReactComponent") return [];
    const artifact = element.componentId ? components[element.componentId] : undefined;
    if (!artifact) return [{ element, errors: ["Component source is missing."] }];
    const compatibility = validateGeneratedComponent(artifact.code);
    return compatibility.compatible ? [] : [{ element, errors: compatibility.errors }];
  })), [tracks, components]);
  const [scale, setScale] = useState(1);
  const [quality, setQuality] = useState<ExportQuality>("medium");
  const [includeAudio, setIncludeAudio] = useState(true);
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(timelineDuration);
  const [filename, setFilename] = useState(`${safeFilename(project.name)}-r${project.revision}.mp4`);
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [encodedFrames, setEncodedFrames] = useState(0);
  const [estimatedTimeMs, setEstimatedTimeMs] = useState(0);
  const [renderRevision, setRenderRevision] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const preparedRef = useRef<PreparedRenderManifest | null>(null);
  const outputUrlRef = useRef<string | null>(null);
  const busy = status === "queued" || status === "preparing" || status === "rendering" || status === "finalizing";
  const validRange = Number.isFinite(rangeStart) && Number.isFinite(rangeEnd) && rangeStart >= 0 && rangeEnd > rangeStart && rangeEnd <= timelineDuration + 0.001;
  const componentsCompatible = incompatibleElements.length === 0;

  useEffect(() => {
    let active = true;
    void storageService.listRenderJobs(project.id).then(async (loaded) => {
      const interrupted = loaded.filter((job) => ["queued", "preparing", "rendering", "finalizing"].includes(job.status));
      if (interrupted.length) {
        await Promise.all(interrupted.map((job) => storageService.saveRenderJob({ ...job, status: "failed", error: "Export was interrupted by a page reload or browser close.", completedAt: Date.now() })));
      }
      if (active) setJobs(await storageService.listRenderJobs(project.id));
    });
    return () => { active = false; };
  }, [project.id]);

  useEffect(() => () => {
    abortRef.current?.abort();
    preparedRef.current?.release();
    if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
  }, []);

  const replaceDownloadUrl = (url: string | null) => {
    if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
    outputUrlRef.current = url;
    setDownloadUrl(url);
  };

  const resetOutput = () => {
    preparedRef.current?.release();
    preparedRef.current = null;
    replaceDownloadUrl(null);
  };

  const refreshJobs = async () => setJobs(await storageService.listRenderJobs(project.id));

  const start = async () => {
    if (!validRange || !componentsCompatible) return;
    resetOutput();
    setError("");
    setProgress(0);
    setEncodedFrames(0);
    setEstimatedTimeMs(0);
    setRenderRevision(project.revision);
    setStatus("queued");
    const controller = new AbortController();
    abortRef.current = controller;
    const settings: RenderJobSettings = {
      scale,
      quality,
      includeAudio,
      rangeStart,
      rangeEnd,
      filename: normalizeMp4Filename(filename),
    };
    let job: RenderJob = {
      id: `render-${project.id}-${Date.now()}`,
      projectId: project.id,
      revision: project.revision,
      settings,
      status: "queued",
      progress: 0,
      createdAt: Date.now(),
    };
    const persist = async (patch: Partial<RenderJob>) => {
      job = { ...job, ...patch };
      await storageService.saveRenderJob(job);
    };
    await persist({});
    void refreshJobs();
    try {
      setStatus("preparing");
      await persist({ status: "preparing" });
      const prepared = await createRenderManifest({ project, tracks, pool, components, range: { start: rangeStart, end: rangeEnd } });
      preparedRef.current = prepared;
      await persist({ manifestId: prepared.manifest.id });
      setStatus("rendering");
      await persist({ status: "rendering" });
      let lastPersistedAt = 0;
      const blob = await renderLocally(prepared.manifest, {
        scale,
        quality,
        includeAudio,
        signal: controller.signal,
        onProgress: (next) => {
          const normalized = Math.max(0, Math.min(1, next.progress));
          setProgress(normalized);
          setEncodedFrames(next.encodedFrames);
          setEstimatedTimeMs(next.estimatedTimeMs);
          if (Date.now() - lastPersistedAt > 750) {
            lastPersistedAt = Date.now();
            void persist({ progress: normalized, encodedFrames: next.encodedFrames, estimatedTimeMs: next.estimatedTimeMs });
          }
        },
      });
      setStatus("finalizing");
      await persist({ status: "finalizing", progress: 1 });
      const outputId = `${job.id}.mp4`;
      await storageService.saveRenderOutput(outputId, blob);
      replaceDownloadUrl(URL.createObjectURL(blob));
      setProgress(1);
      setStatus("complete");
      await persist({ status: "complete", progress: 1, output: { id: outputId, mime: "video/mp4", size: blob.size }, completedAt: Date.now() });
    } catch (cause) {
      if (controller.signal.aborted) {
        setStatus("cancelled");
        setError("Export was cancelled.");
        await persist({ status: "cancelled", error: "Export was cancelled.", completedAt: Date.now() });
      } else {
        const message = cause instanceof Error ? cause.message : "Local export failed.";
        setStatus("failed");
        setError(message);
        await persist({ status: "failed", error: message, completedAt: Date.now() });
      }
    } finally {
      abortRef.current = null;
      preparedRef.current?.release();
      preparedRef.current = null;
      void refreshJobs();
    }
  };

  const downloadJob = async (job: RenderJob) => {
    if (!job.output) return;
    const blob = await storageService.getRenderOutput(job.output.id);
    if (!blob) {
      setError("The cached MP4 is no longer available in browser storage.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = job.settings.filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };

  const deleteJob = async (job: RenderJob) => {
    await storageService.deleteRenderJob(job);
    await refreshJobs();
  };

  return <div role="dialog" aria-modal="true" aria-labelledby="export-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="flex max-h-[92dvh] w-full max-w-[560px] flex-col border border-[#bdbab4] bg-[#f4f3f0] shadow-[0_18px_60px_rgba(0,0,0,.3)]">
      <header className="flex shrink-0 items-center justify-between border-b border-[#cecdc9] px-5 py-4">
        <div><h2 id="export-title" className="text-[15px] font-semibold text-[#302e2b]">Export video</h2><p className="mt-1 text-[11px] text-[#817d76]">Local MP4 · current project revision {project.revision}</p></div>
        <button type="button" disabled={busy} onClick={onClose} className="p-1 text-xl leading-none text-[#77736d] hover:text-[#302e2b] disabled:opacity-30" aria-label="Close export">×</button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 text-[12px] text-[#4b4843]">
        <label className="grid grid-cols-[130px_1fr] items-center gap-3"><span>Resolution</span><select disabled={busy} value={scale} onChange={(event) => setScale(Number(event.target.value))} className="border border-[#c9c6c0] bg-white px-3 py-2 outline-none"><option value={1}>{project.settings.width} × {project.settings.height} (project)</option><option value={0.5}>{makeEven(Math.round(project.settings.width / 2))} × {makeEven(Math.round(project.settings.height / 2))} (half)</option></select></label>
        <label className="grid grid-cols-[130px_1fr] items-center gap-3"><span>Quality</span><select disabled={busy} value={quality} onChange={(event) => setQuality(event.target.value as ExportQuality)} className="border border-[#c9c6c0] bg-white px-3 py-2 outline-none"><option value="low">Draft</option><option value="medium">Standard</option><option value="high">High</option></select></label>
        <div className="grid grid-cols-[130px_1fr] items-center gap-3"><span>Frame rate</span><span className="border border-[#d5d2cc] bg-[#ebe9e5] px-3 py-2 text-[#77736d]">{project.settings.fps} fps</span></div>
        <label className="grid grid-cols-[130px_1fr] items-center gap-3"><span>Audio</span><span className="flex items-center gap-2"><input disabled={busy} type="checkbox" checked={includeAudio} onChange={(event) => setIncludeAudio(event.target.checked)} /> Include timeline audio</span></label>
        <div className="grid grid-cols-[130px_1fr] items-start gap-3"><span className="pt-2">Range</span><div><div className="grid grid-cols-2 gap-2"><NumberField label="Start" value={rangeStart} max={timelineDuration} disabled={busy} onChange={setRangeStart} /><NumberField label="End" value={rangeEnd} max={timelineDuration} disabled={busy} onChange={setRangeEnd} /></div><p className={`mt-1 text-[10px] ${validRange ? "text-[#8a857e]" : "text-[#b64035]"}`}>{validRange ? `Full timeline: 0–${formatSeconds(timelineDuration)}` : `Use a range within 0–${formatSeconds(timelineDuration)}.`}</p></div></div>
        <label className="grid grid-cols-[130px_1fr] items-center gap-3"><span>Filename</span><input disabled={busy} value={filename} onChange={(event) => setFilename(event.target.value)} className="border border-[#c9c6c0] bg-white px-3 py-2 outline-none" /></label>

        {incompatibleElements.length > 0 && <div className="border border-[#d4aa65] bg-[#fff7e6] p-3 text-[11px] leading-5 text-[#745622]"><p className="font-semibold">{incompatibleElements.length} older AI component{incompatibleElements.length === 1 ? " needs" : "s need"} regeneration</p>{incompatibleElements.map(({ element, errors }) => <p key={element.id}><strong>{element.name}:</strong> {errors.join(" ")}</p>)}<p className="mt-2 font-medium">Regenerate these components in AI chat, then export again. Valid deterministic AI animations render directly in MP4.</p></div>}

        {status !== "idle" && <div className="space-y-2 border-t border-[#d4d1cb] pt-4">
          <div className="flex justify-between text-[11px]"><span>{statusLabel(status)}</span><span>{Math.round(progress * 100)}%</span></div>
          <div className="h-1.5 overflow-hidden bg-[#d8d5cf]"><div className="h-full bg-[#e57438] transition-[width]" style={{ width: `${progress * 100}%` }} /></div>
          {status === "rendering" && <p className="text-[10px] text-[#817d76]">{encodedFrames.toLocaleString()} frames encoded{estimatedTimeMs > 0 ? ` · about ${formatDuration(estimatedTimeMs)} remaining` : ""}</p>}
          {renderRevision !== null && project.revision !== renderRevision && <p className="border border-[#9eb3c5] bg-[#eef6fc] p-2 text-[#455f74]">Rendering revision {renderRevision}. Your newer revision {project.revision} will be included in the next export.</p>}
          {error && <p className={status === "failed" ? "text-[#b64035]" : "text-[#77736d]"}>{error}</p>}
        </div>}

        {jobs.length > 0 && <div className="border-t border-[#d4d1cb] pt-4"><h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[.06em] text-[#77736d]">Recent local exports</h3><div className="space-y-1">{jobs.slice(0, 5).map((job) => <div key={job.id} className="flex items-center gap-2 border border-[#d4d1cb] bg-[#efede9] px-3 py-2"><span className={`h-1.5 w-1.5 rounded-full ${job.status === "complete" ? "bg-[#4f9662]" : job.status === "failed" ? "bg-[#bd5148]" : "bg-[#a5a099]"}`} /><span className="min-w-0 flex-1 truncate">{job.settings.filename}</span><span className="text-[10px] text-[#8a857e]">r{job.revision} · {job.status}</span>{job.output && <button type="button" onClick={() => void downloadJob(job)} className="text-[10px] font-semibold text-[#b9592c] hover:underline">Download</button>}<button type="button" onClick={() => void deleteJob(job)} className="text-[13px] text-[#9a958e] hover:text-[#b64035]" aria-label={`Delete ${job.settings.filename}`}>×</button></div>)}</div></div>}
      </div>

      <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[#cecdc9] px-5 py-4">
        {busy ? <button type="button" onClick={() => abortRef.current?.abort()} className="border border-[#bdbab4] bg-white px-4 py-2 text-[12px] hover:bg-[#ebe9e5]">Cancel</button> : <button type="button" onClick={onClose} className="border border-[#bdbab4] bg-white px-4 py-2 text-[12px] hover:bg-[#ebe9e5]">Close</button>}
        {downloadUrl && status === "complete" ? <a href={downloadUrl} download={normalizeMp4Filename(filename)} className="border border-[#c65d2d] bg-[#e57438] px-5 py-2 text-[12px] font-semibold text-white hover:bg-[#d96930]">Download MP4</a> : <button type="button" disabled={busy || !validRange || !componentsCompatible} onClick={() => void start()} className="border border-[#c65d2d] bg-[#e57438] px-5 py-2 text-[12px] font-semibold text-white hover:bg-[#d96930] disabled:opacity-45">{status === "failed" || status === "cancelled" ? "Retry export" : "Render locally"}</button>}
      </footer>
    </section>
  </div>;
}

function NumberField({ label, value, max, disabled, onChange }: { label: string; value: number; max: number; disabled: boolean; onChange: (value: number) => void }) {
  return <label><span className="mb-1 block text-[10px] text-[#817d76]">{label} (seconds)</span><input type="number" min={0} max={max} step="0.01" disabled={disabled} value={Number(value.toFixed(3))} onChange={(event) => onChange(Number(event.target.value))} className="w-full border border-[#c9c6c0] bg-white px-3 py-2 outline-none" /></label>;
}

function statusLabel(status: ExportStatus) {
  if (status === "queued") return "Export queued…";
  if (status === "preparing") return "Checking browser, freezing revision, and loading assets…";
  if (status === "rendering") return "Rendering and encoding MP4 in this browser…";
  if (status === "finalizing") return "Saving MP4 to local browser storage…";
  if (status === "complete") return "Export complete";
  if (status === "failed") return "Export failed";
  if (status === "cancelled") return "Export cancelled";
  return "Ready";
}

function safeFilename(value: string) {
  return value.trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "shiftcut-export";
}

function normalizeMp4Filename(value: string) {
  const clean = safeFilename(value.replace(/\.mp4$/i, ""));
  return `${clean}.mp4`;
}

function formatSeconds(value: number) {
  const minutes = Math.floor(value / 60);
  return `${minutes}:${(value % 60).toFixed(2).padStart(5, "0")}`;
}

function formatDuration(milliseconds: number) {
  const seconds = Math.max(1, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function makeEven(value: number) {
  return value % 2 === 0 ? value : value - 1;
}
