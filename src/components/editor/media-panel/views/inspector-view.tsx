"use client";

import { useState } from "react";
import { useTimelineStore } from "@/stores/timeline-store";
import { useProjectStore } from "@/stores/project-store";
import { useComponentStore } from "@/stores/component-store";
import type { ComponentArtifact } from "@/lib/storage/types";
import { effectiveDuration, type TimelineElement } from "@/types/timeline";

function NumberField({ label, value, onChange, step = 1, min }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
}) {
  return (
    <label className="grid grid-cols-[1fr_92px] items-center gap-3 text-[12px] text-[#605c56]">
      <span>{label}</span>
      <input
        aria-label={label}
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        onChange={(event) => {
          const next = event.currentTarget.valueAsNumber;
          if (Number.isFinite(next)) onChange(next);
        }}
        className="h-7 w-full border border-[#c9c7c2] bg-[#f7f6f4] px-2 text-right text-[12px] text-[#302e2b] outline-none focus:border-[#77736d]"
      />
    </label>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-[#d5d2cc] px-4 py-3">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[.08em] text-[#6e6963]">{title}</h3>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

export function InspectorView() {
  const [idCopied, setIdCopied] = useState(false);
  const selectedElementId = useTimelineStore((state) => state.selectedElementId);
  const tracks = useTimelineStore((state) => state.tracks);
  const updateParams = useTimelineStore((state) => state.updateElementParams);
  const updateStart = useTimelineStore((state) => state.updateElementStartTime);
  const updateTrim = useTimelineStore((state) => state.updateElementTrim);
  const components = useComponentStore((state) => state.components);

  let selected: { element: TimelineElement; track: typeof tracks[number] } | null = null;
  for (const track of tracks) {
    const element = track.elements.find((candidate) => candidate.id === selectedElementId);
    if (element) { selected = { element, track }; break; }
  }

  if (!selected) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-[#d5d2cc] px-4 py-3 text-[13px] font-semibold text-[#292724]">INSPECTOR</div>
        <div className="flex flex-1 items-center justify-center px-8 text-center text-[13px] leading-5 text-[#77736d]">
          Select an element on the timeline to edit its timing and properties.
        </div>
      </div>
    );
  }

  const { element, track } = selected;
  const artifact = element.componentId ? components[element.componentId] : undefined;
  const duration = effectiveDuration(element);
  const end = element.startTime + duration;
  const setEnd = (nextEnd: number) => {
    const nextDuration = Math.max(0.1, nextEnd - element.startTime);
    const trimEnd = Math.max(0, element.duration - element.trimStart - nextDuration);
    updateTrim(element.id, element.trimStart, trimEnd, element.startTime);
  };
  const copyElementId = async () => {
    try {
      await navigator.clipboard.writeText(element.id);
      setIdCopied(true);
      window.setTimeout(() => setIdCopied(false), 1600);
    } catch {
      setIdCopied(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="border-b border-[#d5d2cc] px-4 py-3">
        <div className="text-[13px] font-semibold text-[#292724]">INSPECTOR</div>
        <div className="mt-1 truncate text-[12px] text-[#77736d]">{element.name} · {track.name}</div>
        <div className="mt-2 flex min-w-0 items-center gap-2">
          <code className="min-w-0 flex-1 truncate text-[10px] text-[#89857e]" title={element.id}>{element.id}</code>
          <button type="button" onClick={() => void copyElementId()} className="shrink-0 border border-[#c9c7c2] bg-[#f7f6f4] px-2 py-1 text-[10px] font-medium text-[#56514c] hover:border-[#77736d]">{idCopied ? "ID copied" : "Copy element ID"}</button>
        </div>
      </div>

      <Group title="Timing">
        <NumberField label="Start" value={element.startTime} min={0} step={0.1} onChange={(value) => updateStart(element.id, Math.max(0, value))} />
        <NumberField label="End" value={end} min={element.startTime + 0.1} step={0.1} onChange={setEnd} />
        <NumberField label="Duration" value={duration} min={0.1} step={0.1} onChange={(value) => setEnd(element.startTime + value)} />
      </Group>

      <Group title="Transform">
        <NumberField label="Position X" value={element.params.x} step={1} onChange={(x) => updateParams(element.id, { x })} />
        <NumberField label="Position Y" value={element.params.y} step={1} onChange={(y) => updateParams(element.id, { y })} />
        <NumberField label="Scale" value={element.params.scale} min={0} step={0.01} onChange={(scale) => updateParams(element.id, { scale })} />
        <NumberField label="Rotation" value={element.params.rotation} step={1} onChange={(rotation) => updateParams(element.id, { rotation })} />
        <NumberField label="Opacity" value={element.params.opacity} min={0} step={0.05} onChange={(opacity) => updateParams(element.id, { opacity: Math.min(1, opacity) })} />
        <NumberField label="Layer" value={element.params.zIndex} step={1} onChange={(zIndex) => updateParams(element.id, { zIndex })} />
      </Group>

      {(element.component === "AudioPlayer" || element.component === "VideoPlayer") && (
        <Group title="Audio">
          <NumberField label="Volume" value={typeof element.params.volume === "number" ? element.params.volume : 1} min={0} step={0.05} onChange={(volume) => updateParams(element.id, { volume: Math.min(1, Math.max(0, volume)) })} />
        </Group>
      )}

      <CodeAccordion element={element} artifact={artifact} />
    </div>
  );
}

function CodeAccordion({ element, artifact }: { element: TimelineElement; artifact?: ComponentArtifact }) {
  const project = useProjectStore((state) => state.activeProject);
  const [copied, setCopied] = useState<"code" | "reference" | null>(null);
  const source = playerSource(element, artifact);
  const props = JSON.stringify({
    component: element.component,
    params: element.params,
    propsSchema: artifact?.propsSchema,
  }, null, 2);
  const gptReference = [
    "# ShiftCut component reference",
    `Canvas: ${project?.settings.width ?? "unknown"} × ${project?.settings.height ?? "unknown"} px at ${project?.settings.fps ?? "unknown"} fps`,
    "Coordinate system: x, y, and fontSize are canonical output pixels; scale is unitless.",
    `Timeline element: ${element.name}`,
    `Component name: ${artifact?.name ?? element.component}`,
    `Description: ${artifact?.description ?? (artifact ? "AI-generated React component." : "Built-in player component.")}`,
    "\n## Component code\n",
    source,
    "\n## Live props\n",
    props,
  ].join("\n");
  const copy = async (kind: "code" | "reference", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };
  return (
    <section className="border-b border-[#d5d2cc]">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[11px] font-semibold uppercase tracking-[.08em] text-[#6e6963] hover:bg-[#e6e3df]">
          Component code <span className="text-[15px] font-normal transition group-open:rotate-180">⌄</span>
        </summary>
        <div className="space-y-3 border-t border-[#d5d2cc] px-4 py-3">
          <div className="border border-[#d5d2cc] bg-[#f7f6f4] px-3 py-2 text-[11px] leading-4 text-[#605c56]"><span className="mr-1 font-semibold text-[#49453f]">Description:</span>{artifact?.description ?? "Built-in player component."}</div>
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2"><div className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#89857e]">{artifact ? `Component v${artifact.version}` : "Built-in player contract"}</div><button type="button" onClick={() => void copy("code", source)} className="border border-[#c9c7c2] bg-[#f7f6f4] px-2 py-1 text-[10px] font-medium normal-case tracking-normal text-[#56514c] hover:border-[#77736d]">{copied === "code" ? "Copied" : "Copy code"}</button></div>
            <pre className="max-h-64 overflow-auto border border-[#c9c7c2] bg-[#292724] p-3 text-[10px] leading-4 text-[#ece9e4]"><code>{source}</code></pre>
          </div>
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[.08em] text-[#89857e]">Live props</div>
            <pre className="max-h-44 overflow-auto border border-[#c9c7c2] bg-[#f7f6f4] p-3 text-[10px] leading-4 text-[#49453f]"><code>{props}</code></pre>
          </div>
          <button type="button" onClick={() => void copy("reference", gptReference)} className="w-full border border-[#77736d] bg-[#f7f6f4] px-3 py-2 text-[11px] font-semibold normal-case tracking-normal text-[#302e2b] hover:bg-[#dfdcd7]">{copied === "reference" ? "GPT reference copied" : "Copy GPT reference"}</button>
        </div>
      </details>
    </section>
  );
}

function playerSource(element: TimelineElement, artifact?: ComponentArtifact) {
  if (artifact) return artifact.code;
  if (element.component === "VideoPlayer") return `function VideoPlayer({ src, volume = 1 }) {
  return <video src={src} muted={volume === 0} />;
}`;
  if (element.component === "ImagePlayer") return `function ImagePlayer({ src }) {
  return <img src={src} alt="" />;
}`;
  if (element.component === "AudioPlayer") return `function AudioPlayer({ src, volume = 1 }) {
  return <audio src={src} volume={volume} />;
}`;
  return `function TextPlayer({ text, color = "#ffffff", fontSize = 48 }) {
  return <span style={{ color, fontSize }}>{text}</span>;
}`;
}
