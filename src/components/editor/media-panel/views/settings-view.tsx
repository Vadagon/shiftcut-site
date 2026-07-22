"use client";

import { useState } from "react";
import { useProjectStore } from "@/stores/project-store";
import { cn } from "@/lib/utils";
import { I } from "../../icons";

const RATIOS = [
  { label: "9:16", w: 1080, h: 1920, detail: "Vertical" },
  { label: "3:4", w: 1080, h: 1440, detail: "Portrait" },
  { label: "4:5", w: 1080, h: 1350, detail: "Feed portrait" },
  { label: "1:1", w: 1080, h: 1080, detail: "Square" },
  { label: "5:4", w: 1350, h: 1080, detail: "Landscape" },
  { label: "4:3", w: 1440, h: 1080, detail: "Standard" },
  { label: "3:2", w: 1620, h: 1080, detail: "Photo" },
  { label: "16:9", w: 1920, h: 1080, detail: "Widescreen" },
  { label: "21:9", w: 2520, h: 1080, detail: "Cinematic" },
] as const;

const FPS = [24, 25, 30, 60];
const BG = ["#000000", "#0f172a", "#ffffff", "#1e293b", "#7c3aed", "#059669"];

function Glyph({ w, h }: { w: number; h: number }) {
  const box = 17;
  const ratio = w / h;
  const rw = ratio >= 1 ? box : box * ratio;
  const rh = ratio >= 1 ? box / ratio : box;
  return <svg width={22} height={22} viewBox="0 0 22 22" className="shrink-0"><rect x={(22 - rw) / 2} y={(22 - rh) / 2} width={rw} height={rh} rx={1.5} fill="none" stroke="currentColor" strokeWidth={1.4} /></svg>;
}

function ratioMatches(width: number, height: number, preset: (typeof RATIOS)[number]) {
  return width * preset.h === height * preset.w;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border-b border-[#d5d2cc] px-4 py-3"><h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[.08em] text-[#6e6963]">{title}</h3>{children}</section>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex min-h-8 items-center justify-between gap-3 text-[12px]"><span className="text-[#605c56]">{label}</span>{children}</div>;
}

export function SettingsView() {
  const project = useProjectStore((s) => s.activeProject);
  const rename = useProjectStore((s) => s.rename);
  const updateSettings = useProjectStore((s) => s.updateSettings);
  const [tab, setTab] = useState<"project" | "background">("project");
  if (!project) return null;
  const s = project.settings;
  const current = RATIOS.find((ratio) => ratioMatches(s.width, s.height, ratio));
  const inputClass = "h-7 border border-[#c9c7c2] bg-[#f7f6f4] px-2 text-right text-[12px] text-[#302e2b] outline-none focus:border-[#77736d]";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-[#d5d2cc] px-3">
        <span className="mr-auto text-[13px] font-semibold text-[#292724]">SETTINGS</span>
        <button type="button" title="Project settings" aria-label="Project settings" onClick={() => setTab("project")} className={cn("flex h-7 w-7 items-center justify-center rounded-sm", tab === "project" ? "bg-[#d8d5d0] text-[#292724]" : "text-[#716d67] hover:bg-[#e4e1dd]")}><I.settings width={16} height={16} /></button>
        <button type="button" title="Background" aria-label="Background" onClick={() => setTab("background")} className={cn("flex h-7 w-7 items-center justify-center rounded-sm", tab === "background" ? "bg-[#d8d5d0] text-[#292724]" : "text-[#716d67] hover:bg-[#e4e1dd]")}><I.sun width={16} height={16} /></button>
      </div>

      {tab === "project" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Section title="Project">
            <div className="space-y-2.5">
              <Row label="Name"><input value={project.name} onChange={(event) => rename(event.target.value)} className={`${inputClass} w-40`} /></Row>
              <Row label="Frame rate">
                <div className="relative">
                  <select value={s.fps} onChange={(event) => updateSettings({ fps: Number(event.target.value) })} className="h-7 appearance-none border border-[#c9c7c2] bg-[#f7f6f4] py-0 pl-2 pr-7 text-[12px] text-[#302e2b] outline-none focus:border-[#77736d]">
                    {FPS.map((fps) => <option key={fps} value={fps}>{fps} fps</option>)}
                  </select>
                  <I.chevronDown width={13} height={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#77736d]" />
                </div>
              </Row>
            </div>
          </Section>

          <Section title="Aspect ratio">
            <div className="grid grid-cols-3 gap-1.5">
              {RATIOS.map((ratio) => {
                const selected = current?.label === ratio.label;
                return (
                  <button key={ratio.label} type="button" onClick={() => updateSettings({ width: ratio.w, height: ratio.h })} title={`${ratio.label} · ${ratio.detail}`} className={cn("flex min-h-15 flex-col items-center justify-center gap-0.5 border px-1 py-1.5 text-center transition", selected ? "border-[#77736d] bg-[#dcd9d4] text-[#292724]" : "border-[#d5d2cc] bg-[#f4f2ef] text-[#6c6761] hover:border-[#aaa69f]")}>
                    <Glyph w={ratio.w} h={ratio.h} />
                    <span className="text-[11px] font-semibold">{ratio.label}</span>
                    <span className="text-[9px] leading-none text-[#89857e]">{ratio.detail}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Custom canvas">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-[#6e6963]">Width<input aria-label="Canvas width" type="number" min={16} value={s.width} onChange={(event) => Number.isFinite(event.currentTarget.valueAsNumber) && updateSettings({ width: Math.max(16, Math.round(event.currentTarget.valueAsNumber)) })} className={`${inputClass} mt-1 w-full`} /></label>
              <label className="text-[11px] text-[#6e6963]">Height<input aria-label="Canvas height" type="number" min={16} value={s.height} onChange={(event) => Number.isFinite(event.currentTarget.valueAsNumber) && updateSettings({ height: Math.max(16, Math.round(event.currentTarget.valueAsNumber)) })} className={`${inputClass} mt-1 w-full`} /></label>
            </div>
            <p className="mt-2 text-[10px] text-[#89857e]">Current: {s.width} × {s.height}{current ? ` · ${current.label}` : " · Custom"}</p>
          </Section>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="text-[12px] font-semibold text-[#48443f]">Background color</div>
          <div className="mt-3 grid grid-cols-6 gap-2">
            {BG.map((color) => <button key={color} type="button" onClick={() => updateSettings({ background: color })} className={cn("aspect-square border-2 transition", s.background === color ? "border-[#44413d]" : "border-transparent hover:border-[#aaa69f]")} style={{ background: color }} aria-label={color} />)}
          </div>
          <label className="mt-5 flex items-center justify-between text-[12px] text-[#605c56]">Custom color<input type="color" value={s.background ?? "#000000"} onChange={(event) => updateSettings({ background: event.target.value })} className="h-7 w-12 cursor-pointer border border-[#c9c7c2] bg-transparent p-0.5" /></label>
        </div>
      )}
    </div>
  );
}
