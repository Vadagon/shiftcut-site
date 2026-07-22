"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { storageService } from "@/lib/storage/storage-service";
import { useProjectStore } from "@/stores/project-store";
import { fmtDuration } from "@/lib/time";
import { Mark } from "@/components/logo";
import type { TProject } from "@/types/project";

export default function EditorHome() {
  const router = useRouter();
  const createProject = useProjectStore((s) => s.createProject);
  const [projects, setProjects] = useState<TProject[] | null>(null);

  const refresh = () => storageService.listProjects().then(setProjects);
  useEffect(() => { refresh(); }, []);

  async function startSession() {
    const p = await createProject();
    router.push(`/editor/${p.id}`);
  }
  async function remove(id: string) {
    await storageService.deleteProject(id);
    refresh();
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12 sm:px-8">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2"><Mark className="h-6 w-6" /><span className="font-semibold tracking-tight">ShiftCut Studio</span></Link>
        <button onClick={startSession} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-accent-hover">+ New project</button>
      </div>

      <h1 className="mt-10 text-2xl font-semibold tracking-tight">Projects</h1>
      <p className="mt-1 text-sm text-fg-muted">Your editing sessions live locally in this browser. Nothing is uploaded.</p>

      {projects === null ? (
        <p className="mt-10 text-sm text-fg-subtle">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border-strong bg-surface/40 px-6 py-16 text-center">
          <p className="text-fg-muted">No projects yet.</p>
          <button onClick={startSession} className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-accent-hover">Create your first project</button>
        </div>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id} className="group relative rounded-xl border border-border bg-surface/50 transition hover:border-border-strong">
              <Link href={`/editor/${p.id}`} className="block p-4">
                <div className="aspect-video rounded-lg bg-bg-elevated ring-1 ring-border" />
                <div className="mt-3 truncate font-medium">{p.name}</div>
                <div className="mt-1 flex items-center gap-2 font-mono text-xs text-fg-subtle">
                  <span>rev {p.revision}</span><span>·</span><span>{fmtDuration(0)}</span>
                </div>
              </Link>
              <button onClick={() => remove(p.id)} aria-label="Delete project" className="absolute right-3 top-3 rounded-md border border-border bg-bg/70 px-2 py-1 text-xs text-fg-subtle opacity-0 transition hover:text-fg group-hover:opacity-100">Delete</button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
