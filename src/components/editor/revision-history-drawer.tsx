"use client";

import { useEffect, useState } from "react";
import { storageService } from "@/lib/storage/storage-service";
import type { ProjectRevision } from "@/lib/storage/types";
import { useProjectStore } from "@/stores/project-store";
import { useTimelineStore } from "@/stores/timeline-store";

export function RevisionHistoryDrawer({
  projectId,
  currentRevision,
  onClose,
}: {
  projectId: string;
  currentRevision: number;
  onClose: () => void;
}) {
  const [revisions, setRevisions] = useState<ProjectRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<number | null>(null);

  const refresh = async () => {
    const stored = await storageService.loadRevisions(projectId);
    setRevisions(sortRevisions(stored));
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    void storageService.loadRevisions(projectId).then((stored) => {
      if (cancelled) return;
      setRevisions(sortRevisions(stored));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const restore = async (revision: ProjectRevision) => {
    setRestoring(revision.revision);
    useProjectStore.getState().setSettingsForCommit(revision.project.settings);
    useProjectStore.getState().setCompositionDescriptionForCommit(revision.project.compositionDescription ?? "");
    useTimelineStore.getState().replaceTimeline(structuredClone(revision.tracks), `Restored revision ${revision.revision}: ${revision.summary}`);
    await refresh();
    setRestoring(null);
  };

  return (
    <aside className="absolute right-0 top-14 z-[90] flex h-[calc(100dvh-56px)] w-[380px] flex-col border-l border-[#bdbab4] bg-[#f4f3f0] shadow-[-12px_12px_28px_rgba(0,0,0,.16)]">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#cecdc9] px-4">
        <div>
          <h2 className="text-[14px] font-semibold text-[#302e2b]">Project history</h2>
          <p className="mt-0.5 text-[10px] text-[#817d76]">Current revision {currentRevision}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close project history" className="h-7 w-7 text-[18px] text-[#77736d] hover:text-[#302e2b]">×</button>
      </header>
      <div className="border-b border-[#d4d1cb] bg-[#ebe9e5] px-4 py-2 text-[10px] leading-4 text-[#6d6862]">
        Restore creates a new revision with the selected timeline, canvas settings, and composition description.
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading ? (
          <p className="px-2 py-8 text-center text-[12px] text-[#817d76]">Loading history…</p>
        ) : revisions.length === 0 ? (
          <p className="px-2 py-8 text-center text-[12px] text-[#817d76]">No saved revisions yet.</p>
        ) : (
          <div className="space-y-2">
            {revisions.map((revision) => {
              const isCurrent = revision.revision === currentRevision;
              return (
                <article key={`${revision.revision}-${revision.createdAt}`} className={`border px-3 py-3 ${isCurrent ? "border-[#8eaaa0] bg-[#edf4ef]" : "border-[#d1cec8] bg-[#faf9f7]"}`}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-[#383531]">Revision {revision.revision}</span>
                        {isCurrent && <span className="bg-[#dcebe0] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[.06em] text-[#477158]">Current</span>}
                      </div>
                      <p className="mt-1 text-[11px] leading-4 text-[#5e5953]">{revision.summary}</p>
                      <p className="mt-1 text-[9px] text-[#928d86]">{formatRevisionDate(revision.createdAt)}</p>
                    </div>
                    <button
                      type="button"
                      disabled={isCurrent || restoring !== null}
                      onClick={() => void restore(revision)}
                      className="shrink-0 border border-[#aaa69f] bg-[#f7f6f4] px-2 py-1 text-[9px] font-semibold text-[#56514c] hover:border-[#77736d] hover:bg-[#e7e4df] disabled:cursor-default disabled:opacity-35"
                    >
                      {restoring === revision.revision ? "Restoring…" : "Restore"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

function sortRevisions(revisions: ProjectRevision[]) {
  return [...revisions].sort((a, b) => b.revision - a.revision);
}

function formatRevisionDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}
