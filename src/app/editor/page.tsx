"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { storageService } from "@/lib/storage/storage-service";
import { useProjectStore } from "@/stores/project-store";
import { fmtDuration } from "@/lib/time";
import { Mark } from "@/components/logo";
import { totalDuration, type TimelineTrack } from "@/types/timeline";
import type { TProject } from "@/types/project";

type ProjectRow = TProject & { tracks: TimelineTrack[]; duration: number };

async function loadProjectRows() {
  const rows = await storageService.listProjects();
  return Promise.all(rows.map(async (project) => {
    const tracks = (await storageService.loadTimeline(project.id))?.tracks ?? [];
    return { ...project, tracks, duration: totalDuration(tracks) };
  }));
}

export default function EditorHome() {
  const router = useRouter();
  const createProject = useProjectStore((state) => state.createProject);
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    setProjects(await loadProjectRows());
  };
  useEffect(() => {
    let active = true;
    void loadProjectRows().then((rows) => { if (active) setProjects(rows); });
    return () => { active = false; };
  }, []);

  async function startSession() {
    if (creating) return;
    setCreating(true);
    const project = await createProject();
    router.push(`/editor/${project.id}`);
  }

  async function remove(id: string) {
    await storageService.deleteProject(id);
    await refresh();
  }

  const totalRevisions = projects?.reduce((sum, project) => sum + project.revision, 0) ?? 0;
  const totalMinutes = projects?.reduce((sum, project) => sum + project.duration, 0) ?? 0;

  return (
    <div className="min-h-dvh bg-[#e9e8e5] text-[#35332f]">
      <header className="flex h-14 items-center justify-between border-b border-[#cecdc9] bg-[#efeeeb] px-4">
        <Link href="/" className="flex items-center gap-2 text-[13px] font-semibold text-[#45423e]">
          <Mark className="h-5 w-5" /><span>ShiftCut</span>
        </Link>
        <div className="absolute left-1/2 -translate-x-1/2 text-[13px] font-medium text-[#5b5752]">Projects</div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 text-[10px] font-semibold text-[#8d8982] sm:inline-flex"><i className="h-1.5 w-1.5 rounded-full bg-[#aaa69f]" />Local workspace</span>
          <button type="button" onClick={() => void startSession()} disabled={creating} className="rounded-[4px] border border-[#c65d2d] bg-[#e57438] px-4 py-2 text-[12px] font-semibold text-white shadow-[inset_0_1px_rgba(255,255,255,.35)] hover:bg-[#d96930] disabled:opacity-50">
            {creating ? "Creating…" : "+ New project"}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1320px] px-5 py-8 sm:px-8 lg:px-10">
        <section className="grid border border-[#cecdc9] bg-[#efeeeb] lg:grid-cols-[1fr_430px]">
          <div className="flex min-h-[230px] flex-col justify-between p-7 sm:p-9">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#918c85]">Browser-native video workspace</p>
              <h1 className="mt-3 max-w-xl text-[28px] font-semibold leading-[1.08] tracking-[-.03em] text-[#302e2b] sm:text-[36px]">Continue an edit or start with an empty timeline.</h1>
              <p className="mt-4 max-w-lg text-[12px] leading-5 text-[#77726c]">Projects, media, revisions, and exports stay in this browser. AI edits use the same undoable timeline as manual changes.</p>
            </div>
            <div className="mt-7 flex flex-wrap gap-2">
              <button type="button" onClick={() => void startSession()} className="border border-[#c65d2d] bg-[#e57438] px-4 py-2 text-[11px] font-semibold text-white hover:bg-[#d96930]">Create editing session</button>
              <span className="border border-[#c9c7c2] bg-[#f7f6f4] px-3 py-2 text-[10px] text-[#77726c]">No upload required</span>
            </div>
          </div>
          <EditorMiniature />
        </section>

        <section className="mt-4 grid grid-cols-3 border border-[#cecdc9] bg-[#efeeeb]">
          <Metric label="Projects" value={projects === null ? "—" : String(projects.length)} />
          <Metric label="Saved revisions" value={projects === null ? "—" : String(totalRevisions)} border />
          <Metric label="Timeline time" value={projects === null ? "—" : fmtDuration(totalMinutes)} border />
        </section>

        <section className="mt-9">
          <div className="flex items-end justify-between border-b border-[#cecdc9] pb-3">
            <div>
              <h2 className="text-[14px] font-semibold text-[#3e3a36]">Your projects</h2>
              <p className="mt-1 text-[10px] text-[#89857e]">Most recently edited first</p>
            </div>
            <span className="text-[10px] text-[#918c85]">IndexedDB + OPFS</span>
          </div>

          {projects === null ? (
            <LoadingGrid />
          ) : projects.length === 0 ? (
            <EmptyProjects onCreate={() => void startSession()} />
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <li key={project.id} className="group relative border border-[#cecdc9] bg-[#efeeeb] transition hover:border-[#a9a59f] hover:shadow-[0_6px_18px_rgba(55,50,44,.08)]">
                  <Link href={`/editor/${project.id}`} className="block">
                    <ProjectPreview project={project} />
                    <div className="border-t border-[#cecdc9] px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-[12px] font-semibold text-[#403d38]">{project.name}</span>
                        <span className="shrink-0 text-[9px] text-[#97928b]">{relativeDate(project.updatedAt)}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 font-mono text-[9px] text-[#87827b]">
                        <span>r{project.revision}</span><span>·</span><span>{fmtDuration(project.duration)}</span><span>·</span><span>{project.settings.width}×{project.settings.height}</span>
                      </div>
                    </div>
                  </Link>
                  <button type="button" onClick={() => void remove(project.id)} aria-label={`Delete ${project.name}`} className="absolute right-2 top-2 border border-[#bbb7b0] bg-[#efeeeb]/95 px-2 py-1 text-[9px] font-medium text-[#77726c] opacity-0 transition hover:border-[#b84d42] hover:text-[#b13c32] group-hover:opacity-100 focus:opacity-100">Delete</button>
                </li>
              ))}
              <li>
                <button type="button" onClick={() => void startSession()} className="flex h-full min-h-[240px] w-full flex-col items-center justify-center border border-dashed border-[#bbb7b0] bg-[#efeeeb]/45 text-[#7e7972] transition hover:border-[#98938c] hover:bg-[#efeeeb]">
                  <span className="flex h-9 w-9 items-center justify-center border border-[#bcb8b1] text-[20px] font-light">+</span>
                  <span className="mt-3 text-[11px] font-semibold">New project</span>
                  <span className="mt-1 text-[9px]">Start from an empty timeline</span>
                </button>
              </li>
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value, border = false }: { label: string; value: string; border?: boolean }) {
  return <div className={`${border ? "border-l border-[#cecdc9]" : ""} px-5 py-4 sm:px-7`}>
    <div className="text-[9px] font-semibold uppercase tracking-[.08em] text-[#928d86]">{label}</div>
    <div className="mt-1 font-mono text-[16px] text-[#49453f]">{value}</div>
  </div>;
}

function EditorMiniature() {
  return <div className="relative min-h-[230px] overflow-hidden border-t border-[#cecdc9] bg-[#e7e5e1] p-5 lg:border-l lg:border-t-0">
    <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(#cecbc6_1px,transparent_1px),linear-gradient(90deg,#cecbc6_1px,transparent_1px)] [background-size:42px_42px]" />
    <div className="relative mx-auto h-full max-w-[360px] border border-[#aaa69f] bg-[#efeeeb] shadow-[0_12px_30px_rgba(55,50,44,.12)]">
      <div className="flex h-7 items-center justify-between border-b border-[#c9c7c2] px-2 text-[7px] font-semibold text-[#67625c]"><span>AI</span><span>VIEWER</span><span className="bg-[#e57438] px-2 py-1 text-white">Export</span></div>
      <div className="grid h-[92px] grid-cols-[32%_1fr]">
        <div className="border-r border-[#c9c7c2] p-2"><div className="h-1.5 w-10 bg-[#b4b0aa]" /><div className="mt-2 h-1 w-full bg-[#d3d0cb]" /><div className="mt-1 h-1 w-4/5 bg-[#d3d0cb]" /><div className="mt-1 h-1 w-3/5 bg-[#d3d0cb]" /></div>
        <div className="flex items-center justify-center bg-[#e9e7e3]"><div className="h-[72px] w-[41px] bg-[#171717] p-1"><div className="mt-6 h-3 bg-[#d16e3e] text-center text-[4px] font-bold text-white">SHIFT CUT</div></div></div>
      </div>
      <div className="border-t border-[#aaa69f] bg-[#e6e4e0]">
        <div className="h-5 border-b border-[#c9c7c2]" />
        <MiniTrack color="#b75b8d" left="18%" width="24%" />
        <MiniTrack color="#5f9ac6" left="4%" width="68%" />
        <MiniTrack color="#57946b" left="12%" width="77%" />
      </div>
    </div>
  </div>;
}

function MiniTrack({ color, left, width }: { color: string; left: string; width: string }) {
  return <div className="relative h-6 border-b border-[#cbc8c3]"><span className="absolute left-1 top-1 text-[5px] font-bold text-[#77726c]">V</span><span className="absolute top-1.5 h-3.5 rounded-[2px] opacity-90" style={{ backgroundColor: color, left, width }} /></div>;
}

function ProjectPreview({ project }: { project: ProjectRow }) {
  const tracks = project.tracks.slice(0, 4);
  const duration = Math.max(1, project.duration);
  return <div className="relative h-[170px] overflow-hidden bg-[#e5e3df] p-3">
    <div className="absolute inset-x-0 top-0 h-6 border-b border-[#c8c5bf] bg-[#dad8d4]" />
    <div className="absolute left-3 right-3 top-8 bottom-3 border border-[#c5c1bb] bg-[#eceae7]">
      <div className="grid h-5 grid-cols-5 border-b border-[#cbc8c2] px-1 font-mono text-[5px] text-[#8d8881]"><span>00:00</span><span>00:02</span><span>00:04</span><span>00:06</span><span>00:08</span></div>
      {tracks.length === 0 ? <div className="flex h-[105px] items-center justify-center text-[8px] text-[#9a958e]">Empty timeline</div> : tracks.map((track, trackIndex) => (
        <div key={track.id} className="relative h-[27px] border-b border-[#d1cec9]">
          <span className={`absolute left-1 top-1 flex h-4 w-5 items-center justify-center rounded-[2px] text-[6px] font-bold text-white ${track.type === "audio" ? "bg-[#61a173]" : "bg-[#64a1cc]"}`}>{track.type === "audio" ? "A" : "V"}{trackIndex + 1}</span>
          <div className="absolute bottom-1 left-8 right-1 top-1">
            {track.elements.map((element) => {
              const left = Math.min(96, element.startTime / duration * 100);
              const width = Math.max(3, Math.min(100 - left, (element.duration - element.trimStart - element.trimEnd) / duration * 100));
              const color = track.type === "audio" ? "#57946b" : element.componentId ? "#b65e90" : "#5f9ac6";
              return <span key={element.id} className="absolute inset-y-0 rounded-[2px] border border-black/20" style={{ left: `${left}%`, width: `${width}%`, backgroundColor: color }} />;
            })}
          </div>
        </div>
      ))}
      <span className="absolute bottom-0 top-5 left-[38%] w-px bg-[#e57438]" />
    </div>
  </div>;
}

function EmptyProjects({ onCreate }: { onCreate: () => void }) {
  return <div className="mt-4 grid min-h-[280px] place-items-center border border-dashed border-[#bbb7b0] bg-[#efeeeb]/55 p-8 text-center">
    <div>
      <div className="mx-auto flex h-12 w-12 items-center justify-center border border-[#bbb7b0] bg-[#e5e3df]"><span className="h-5 w-7 border border-[#8e8982]"><i className="block mt-2 h-px bg-[#8e8982]" /></span></div>
      <h3 className="mt-4 text-[13px] font-semibold">No editing sessions yet</h3>
      <p className="mt-2 text-[10px] leading-4 text-[#87827b]">Create a project to open the editor and begin building your timeline.</p>
      <button type="button" onClick={onCreate} className="mt-5 border border-[#c65d2d] bg-[#e57438] px-4 py-2 text-[11px] font-semibold text-white hover:bg-[#d96930]">Create first project</button>
    </div>
  </div>;
}

function LoadingGrid() {
  return <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-[240px] animate-pulse border border-[#cecdc9] bg-[#e1dfdb]" />)}</div>;
}

function relativeDate(timestamp: number) {
  const days = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
