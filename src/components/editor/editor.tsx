"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useProjectStore } from "@/stores/project-store";
import { useTimelineStore } from "@/stores/timeline-store";
import { useMediaStore } from "@/stores/media-store";
import { useComponentStore } from "@/stores/component-store";
import { usePlaybackStore } from "@/stores/playback-store";
import { MediaPanel } from "./media-panel";
import { PreviewPanel } from "./preview-panel";
import { Timeline } from "./timeline";
import { I } from "./icons";
import { AiChat } from "./ai-chat";

const MIN_CHAT_WIDTH = 260;
const MIN_ASSETS_WIDTH = 260;
const MIN_VIEWER_WIDTH = 360;
const MIN_VIEWER_HEIGHT = 220;
const MIN_TIMELINE_HEIGHT = 200;

export function Editor({ projectId }: { projectId: string }) {
  const activeProject = useProjectStore((s) => s.activeProject);
  const loading = useProjectStore((s) => s.loading);
  const notFound = useProjectStore((s) => s.notFound);
  const loadProject = useProjectStore((s) => s.loadProject);
  const rename = useProjectStore((s) => s.rename);
  const loadTimeline = useTimelineStore((s) => s.loadTimeline);
  const undo = useTimelineStore((s) => s.undo);
  const redo = useTimelineStore((s) => s.redo);
  const canUndo = useTimelineStore((s) => s._history.length > 0);
  const canRedo = useTimelineStore((s) => s._redo.length > 0);
  const loadForProject = useMediaStore((s) => s.loadForProject);
  const loadComponents = useComponentStore((s) => s.loadForProject);
  const seek = usePlaybackStore((s) => s.seek);
  const [chatWidth, setChatWidth] = useState<number | null>(null);
  const [assetsWidth, setAssetsWidth] = useState<number | null>(null);
  const [viewerHeight, setViewerHeight] = useState<number | null>(null);
  const [visiblePanels, setVisiblePanels] = useState({ chat: true, assets: true, viewer: true, timeline: true });
  const [layoutOpen, setLayoutOpen] = useState(false);
  const layoutRef = useRef<HTMLElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const assetsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProject(projectId);
    void loadTimeline(projectId).then(() => loadComponents(projectId));
    loadForProject(projectId);
    seek(0);
  }, [projectId, loadProject, loadTimeline, loadForProject, loadComponents, seek]);

  if (loading) return <Center>Loading project…</Center>;
  if (notFound || !activeProject)
    return <Center>Project not found. <Link href="/editor" className="text-blue-600 underline">Back to projects</Link></Center>;

  const startResize = (pane: "chat" | "assets") => (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const target = pane === "chat" ? chatRef.current : assetsRef.current;
    const startingWidth = target?.getBoundingClientRect().width ?? 0;
    const startX = event.clientX;

    const move = (moveEvent: PointerEvent) => {
      const layoutWidth = layoutRef.current?.clientWidth ?? window.innerWidth;
      const min = pane === "chat" ? MIN_CHAT_WIDTH : MIN_ASSETS_WIDTH;
      const workspaceWidth = workspaceRef.current?.getBoundingClientRect().width ?? layoutWidth;
      const minimumRemainingWidth = pane === "chat"
        ? (visiblePanels.assets || visiblePanels.viewer ? MIN_VIEWER_WIDTH : 0)
        : (visiblePanels.viewer ? MIN_VIEWER_WIDTH : 0);
      const max = Math.max(min, (pane === "chat" ? layoutWidth : workspaceWidth) - minimumRemainingWidth - 4);
      const next = Math.min(max, Math.max(min, startingWidth + moveEvent.clientX - startX));
      if (pane === "chat") setChatWidth(next);
      else setAssetsWidth(next);
    };
    const stop = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  const startTimelineResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startingHeight = topRef.current?.getBoundingClientRect().height ?? 0;
    const startY = event.clientY;
    const move = (moveEvent: PointerEvent) => {
      const layoutHeight = workspaceRef.current?.clientHeight ?? window.innerHeight - 56;
      const maxViewer = Math.max(MIN_VIEWER_HEIGHT, layoutHeight - MIN_TIMELINE_HEIGHT - 4);
      setViewerHeight(Math.min(maxViewer, Math.max(MIN_VIEWER_HEIGHT, startingHeight + moveEvent.clientY - startY)));
    };
    const stop = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  return (
    <div className="h-dvh overflow-hidden bg-[#e9e8e5] text-[#35332f]">
      <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-[#cecdc9] bg-[#efeeeb] px-4">
          <Link href="/editor" aria-label="All projects" className="rounded-md p-1 text-[#4a4743] hover:bg-[#efedea]"><HomeIcon /></Link>
          <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-3 text-[14px] font-medium text-[#514e49]">
            <input aria-label="Project name" value={activeProject.name} onChange={(e) => rename(e.target.value)} className="w-44 truncate bg-transparent text-center outline-none" />
            <span className="text-[#77736d]">...</span><span className="text-[19px]">♧</span>
          </div>
          <div className="relative flex items-center gap-2.5">
            <button onClick={undo} disabled={!canUndo} title="Undo" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><I.undo width={18} height={18} /></button>
            <button onClick={redo} disabled={!canRedo} title="Redo" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><I.redo width={18} height={18} /></button>
            <button title="History" className="rounded-lg p-2 text-[#4e4a45] hover:bg-[#efedea]">◴</button>
            <button type="button" onClick={() => setLayoutOpen((open) => !open)} title="Panels" aria-expanded={layoutOpen} className="rounded-lg p-2 text-[#4e4a45] hover:bg-[#efedea]">⊞</button>
            {layoutOpen && <PanelVisibilityMenu visiblePanels={visiblePanels} onToggle={(panel) => setVisiblePanels((current) => ({ ...current, [panel]: !current[panel] }))} />}
            <McpStatus />
            <button className="rounded-[4px] border border-[#c65d2d] bg-[#e57438] px-5 py-2 text-[13px] font-semibold text-white shadow-[inset_0_1px_rgba(255,255,255,.35)] hover:bg-[#d96930]">Export</button>
            <span className="border-l border-[#d2cfca] pl-3 text-[13px] font-semibold text-[#56524d]">✣ 4.6</span><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#d7b49d] text-[11px] font-semibold text-white">S</span>
          </div>
      </header>

      <main ref={layoutRef} className="flex h-[calc(100dvh-56px)] min-h-0 overflow-hidden">
        {visiblePanels.chat && <div ref={chatRef} className="min-h-0 shrink-0" style={{ width: chatWidth ?? "30.3vw", minWidth: MIN_CHAT_WIDTH }}><AiChat /></div>}
        {visiblePanels.chat && <PanelSeparator onPointerDown={startResize("chat")} />}
        <section ref={workspaceRef} className="flex min-w-0 flex-1 flex-col">
          {(visiblePanels.assets || visiblePanels.viewer) && <div ref={topRef} className={`flex min-h-0 ${visiblePanels.timeline ? "shrink-0" : "flex-1"}`} style={visiblePanels.timeline ? { height: viewerHeight ?? "44%" } : undefined}>
            {visiblePanels.assets && <div ref={assetsRef} className="min-h-0 shrink-0" style={{ width: assetsWidth ?? "min(30%, 460px)", minWidth: MIN_ASSETS_WIDTH }}><MediaPanel /></div>}
            {visiblePanels.assets && visiblePanels.viewer && <PanelSeparator onPointerDown={startResize("assets")} />}
            {visiblePanels.viewer && <div className="min-w-0 flex-1"><PreviewPanel /></div>}
          </div>}
          {visiblePanels.timeline && <TimelineSeparator onPointerDown={startTimelineResize} />}
          {visiblePanels.timeline && <div className="min-h-0 flex-1"><Timeline /></div>}
        </section>
      </main>
    </div>
  );
}

function PanelSeparator({ onPointerDown }: { onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void }) {
  return <div aria-label="Resize panel" role="separator" aria-orientation="vertical" onPointerDown={onPointerDown} className="group z-20 flex w-[4px] shrink-0 touch-none cursor-col-resize justify-center bg-transparent hover:bg-[#cecdc9]/20"><span className="h-full w-px bg-[#cecdc9] group-hover:bg-[#aaa9a5]" /></div>;
}

function TimelineSeparator({ onPointerDown }: { onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void }) {
  return <div aria-label="Resize timeline" role="separator" aria-orientation="horizontal" onPointerDown={onPointerDown} className="group z-20 flex h-[4px] shrink-0 touch-none cursor-row-resize items-center bg-transparent hover:bg-[#cecdc9]/20"><span className="h-px w-full bg-[#cecdc9] group-hover:bg-[#aaa9a5]" /></div>;
}

function McpStatus() {
  return <span title="Coming soon: connect Codex, Claude, or Gemini through MCP. It will be free with your own AI connection." className="inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold text-[#8d8982]"><i className="h-1.5 w-1.5 rounded-full bg-[#aaa69f]" />MCP · soon</span>;
}

function PanelVisibilityMenu({ visiblePanels, onToggle }: { visiblePanels: Record<"chat" | "assets" | "viewer" | "timeline", boolean>; onToggle: (panel: "chat" | "assets" | "viewer" | "timeline") => void }) {
  const items: Array<["chat" | "assets" | "viewer" | "timeline", string]> = [["chat", "AI chat"], ["assets", "Assets / inspector"], ["viewer", "Viewer"], ["timeline", "Timeline"]];
  return <div role="menu" className="absolute right-[108px] top-11 z-50 w-48 border border-[#c9c7c2] bg-[#f6f5f2] p-1.5 shadow-[0_8px_20px_rgba(0,0,0,.14)]">
    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[.08em] text-[#8a857e]">Panels</p>
    {items.map(([panel, label]) => <button key={panel} type="button" role="menuitemcheckbox" aria-checked={visiblePanels[panel]} onClick={() => onToggle(panel)} className="flex w-full items-center justify-between px-2 py-2 text-left text-[12px] text-[#48443f] hover:bg-[#e7e4df]">
      <span>{label}</span><span className={visiblePanels[panel] ? "text-[#4d8f5d]" : "text-[#aaa69f]"}>{visiblePanels[panel] ? "✓" : "—"}</span>
    </button>)}
  </div>;
}

function HomeIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>;
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex h-dvh items-center justify-center bg-slate-100 text-sm text-slate-500">{children}</div>;
}
