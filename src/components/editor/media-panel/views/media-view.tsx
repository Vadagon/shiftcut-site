"use client";

import { useEffect, useRef, useState } from "react";
import { useMediaStore } from "@/stores/media-store";
import { useAssetDragStore } from "@/stores/asset-drag-store";
import { fmtDuration } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { MediaFileData } from "@/lib/storage/types";
import { storageService } from "@/lib/storage/storage-service";
import { I } from "../../icons";

export function MediaView({ audioOnly = false }: { audioOnly?: boolean }) {
  const pool = useMediaStore((s) => s.pool);
  const projectAssetIds = useMediaStore((s) => s.projectAssetIds);
  const importFiles = useMediaStore((s) => s.importFiles);
  const addToProject = useMediaStore((s) => s.addToProject);
  const [poolOpen, setPoolOpen] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const inProject = projectAssetIds.map((id) => pool.find((m) => m.id === id)).filter(Boolean) as MediaFileData[];
  const visible = audioOnly ? inProject.filter((a) => a.kind === "audio") : inProject;

  const supportsFiles = (event: React.DragEvent) => event.dataTransfer.types.includes("Files");
  const upload = (files: FileList | null) => { if (files?.length) void importFiles(files); };

  return (
    <div
      className="relative flex h-full min-h-0 flex-col"
      onDragEnter={(event) => { if (!supportsFiles(event)) return; event.preventDefault(); dragDepth.current += 1; setIsDropTarget(true); }}
      onDragOver={(event) => { if (supportsFiles(event)) event.preventDefault(); }}
      onDragLeave={(event) => { if (!supportsFiles(event)) return; dragDepth.current -= 1; if (dragDepth.current <= 0) { dragDepth.current = 0; setIsDropTarget(false); } }}
      onDrop={(event) => { if (!supportsFiles(event)) return; event.preventDefault(); dragDepth.current = 0; setIsDropTarget(false); upload(event.dataTransfer.files); }}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-[#d5d2cc] px-4 py-3">
        <button type="button" onClick={() => fileRef.current?.click()} className="flex h-10 flex-1 items-center justify-center gap-2 border border-[#77736d] bg-[#f7f6f4] text-[12px] font-semibold text-[#302e2b] transition hover:bg-[#dfdcd7]">
          <I.import width={17} height={17} /> Upload files
        </button>
        <button type="button" onClick={() => setPoolOpen(true)} title="All assets saved in this browser" className="flex h-10 w-10 items-center justify-center border border-[#c9c7c2] bg-[#f7f6f4] text-[#56514c] transition hover:border-[#77736d] hover:bg-[#dfdcd7]">
          <I.layers width={17} height={17} />
        </button>
        <input ref={fileRef} type="file" hidden multiple accept={audioOnly ? "audio/*" : "video/*,audio/*,image/*"} onChange={(event) => { upload(event.target.files); event.currentTarget.value = ""; }} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {visible.length === 0 ? (
          <div className="flex h-full min-h-44 flex-col items-center justify-center border border-dashed border-[#c9c7c2] px-6 text-center">
            <I.import width={23} height={23} className="mb-3 text-[#76716b]" />
            <p className="text-[13px] font-medium text-[#48443f]">No {audioOnly ? "audio" : "assets"} in this project</p>
            <p className="mt-1 text-[11px] leading-4 text-[#807b74]">Upload files or open All assets to add media saved from another project.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-6">
            {visible.map((m) => <MediaCard key={m.id} item={m} />)}
          </div>
        )}
      </div>

      {isDropTarget && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center border-2 border-[#77736d] bg-[#edebe8]/95 p-6">
          <div className="flex max-w-52 flex-col items-center text-center">
            <I.import width={30} height={30} className="mb-3 text-[#48443f]" />
            <span className="text-[14px] font-semibold text-[#302e2b]">Drop files to upload</span>
            <span className="mt-1 text-[11px] text-[#706b65]">They will be added to this project and saved in All assets.</span>
          </div>
        </div>
      )}

      {poolOpen && <GlobalPoolModal onClose={() => setPoolOpen(false)} pool={pool} inProjectIds={projectAssetIds} onAdd={async (ids) => { await addToProject(ids); setPoolOpen(false); }} />}
    </div>
  );
}

function MediaCard({ item }: { item: MediaFileData }) {
  const start = useAssetDragStore((s) => s.start);
  const onPointerDown = (e: React.PointerEvent) => { e.preventDefault(); start(item.id, e.clientX, e.clientY); };
  return (
    <div onPointerDown={onPointerDown} title={item.name} className="group cursor-grab overflow-hidden bg-transparent transition active:cursor-grabbing">
      <div className="relative aspect-video border border-[#cbc9c4] bg-[linear-gradient(45deg,#e3e1dd_25%,transparent_25%,transparent_75%,#e3e1dd_75%),linear-gradient(45deg,#e3e1dd_25%,transparent_25%,transparent_75%,#e3e1dd_75%)] bg-[length:20px_20px] bg-[position:0_0,10px_10px]">
        <AssetThumbnail item={item} />
        {item.duration ? <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] font-medium text-white">{fmtDuration(item.duration)}</span> : null}
      </div>
      <div className="truncate pt-2 text-[13px] text-[#5e5a55]">{item.name}</div>
    </div>
  );
}

function AssetThumbnail({ item }: { item: MediaFileData }) {
  const [source, setSource] = useState<string | null>(item.thumb ?? null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let disposed = false;
    setSource(item.thumb ?? null);

    // Existing projects may contain the old, revoked blob: thumbnails. Reading
    // image binaries from OPFS makes those assets render without re-importing.
    if (item.kind === "image") {
      void storageService.getMediaUrl(item.id).then((url) => {
        if (disposed) { if (url) URL.revokeObjectURL(url); return; }
        objectUrl = url;
        if (url) setSource(url);
      });
    }
    return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [item.id, item.kind, item.thumb]);

  if (!source) return <div className="flex h-full items-center justify-center text-[11px] text-slate-400">{item.kind}</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={source} alt="" className="h-full w-full object-cover" />;
}

function GlobalPoolModal({ pool, inProjectIds, onClose, onAdd }: { pool: MediaFileData[]; inProjectIds: string[]; onClose: () => void; onAdd: (ids: string[]) => void }) {
  const available = pool.filter((a) => !inProjectIds.includes(a.id));
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col border border-[#aaa69f] bg-[#efeeeb] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#c9c7c2] px-5 py-4">
          <div>
            <h2 className="text-[14px] font-semibold text-[#292724]">All assets</h2>
            <p className="text-[12px] text-[#706b65]">Assets stored in this browser from every project. Select to add them here.</p>
          </div>
          <button onClick={onClose} className="text-[#77736d] hover:text-[#292724]">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {available.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-[#77736d]">Every saved asset is already in this project.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {available.map((a) => {
                const on = picked.has(a.id);
                return (
                  <button key={a.id} onClick={() => toggle(a.id)} className={cn("overflow-hidden border text-left transition", on ? "border-[#44413d] ring-1 ring-[#77736d]" : "border-[#c9c7c2] hover:border-[#77736d]")}>
                    <div className="aspect-video bg-[#e2e0dc]">
                      <AssetThumbnail item={a} />
                    </div>
                    <div className="truncate px-2 py-1 text-[11px] text-[#605c56]">{a.name}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#c9c7c2] px-5 py-3">
          <button onClick={onClose} className="px-3 py-1.5 text-[12px] text-[#605c56] hover:text-[#292724]">Cancel</button>
          <button disabled={picked.size === 0} onClick={() => onAdd([...picked])} className="border border-[#44413d] bg-[#44413d] px-3.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40">Add {picked.size || ""} to project</button>
        </div>
      </div>
    </div>
  );
}
