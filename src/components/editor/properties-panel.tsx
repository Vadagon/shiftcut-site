"use client";

import { useMemo, useState } from "react";
import { useTimelineStore } from "@/stores/timeline-store";
import { cn } from "@/lib/utils";
import { I } from "./icons";

type Tab = "transform" | "audio" | "speed" | "opacity" | "layers" | "adjust";
const TABS: { key: Tab; Icon: typeof I.transform }[] = [
  { key: "transform", Icon: I.transform },
  { key: "audio", Icon: I.audio },
  { key: "speed", Icon: I.speed },
  { key: "opacity", Icon: I.opacity },
  { key: "layers", Icon: I.layers },
  { key: "adjust", Icon: I.adjust },
];

export function PropertiesPanel() {
  const selectedId = useTimelineStore((s) => s.selectedElementId);
  const tracks = useTimelineStore((s) => s.tracks);
  const updateParams = useTimelineStore((s) => s.updateElementParams);
  const [tab, setTab] = useState<Tab>("transform");
  const [locked, setLocked] = useState(true);

  // Derive the selected element from stable references (avoids returning a new
  // object from the store selector, which triggers getSnapshot loops).
  const el = useMemo(() => {
    if (!selectedId) return null;
    for (const t of tracks) {
      const e = t.elements.find((x) => x.id === selectedId);
      if (e) return e;
    }
    return null;
  }, [selectedId, tracks]);

  return (
    <aside className="flex w-80 shrink-0 border-l border-slate-200 bg-white">
      <div className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-slate-100 py-3">
        {TABS.map(({ key, Icon }) => (
          <button key={key} onClick={() => setTab(key)} title={key} className={cn("flex h-9 w-9 items-center justify-center rounded-lg", tab === key ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:bg-slate-100")}><Icon width={18} height={18} /></button>
        ))}
      </div>

      {!el ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-400">Select a clip to edit its parameters.</div>
      ) : (
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-[15px] font-semibold capitalize text-slate-800">{tab}</span>
            <I.chevronDown width={16} height={16} className="text-slate-400" />
          </div>
          {tab === "transform" ? (
            <div className="space-y-5 p-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <Field label="Width" value={Math.round(((el.params.scaleX ?? el.params.scale) as number) * 100)} onChange={(v) => { const s = v / 100; updateParams(el.id, locked ? { scaleX: s, scaleY: s, scale: s } : { scaleX: s }); }} />
                <button onClick={() => setLocked((l) => !l)} title="Lock aspect ratio" className={cn("mb-2 rounded-md p-1.5", locked ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:bg-slate-100")}><I.link width={15} height={15} /></button>
                <Field label="Height" value={Math.round(((el.params.scaleY ?? el.params.scale) as number) * 100)} onChange={(v) => { const s = v / 100; updateParams(el.id, locked ? { scaleX: s, scaleY: s, scale: s } : { scaleY: s }); }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="X" value={Math.round(el.params.x)} onChange={(v) => updateParams(el.id, { x: v })} />
                <Field label="Y" value={Math.round(el.params.y)} onChange={(v) => updateParams(el.id, { y: v })} />
              </div>
              <Field label="Rotation" value={Math.round(el.params.rotation)} onChange={(v) => updateParams(el.id, { rotation: v })} />
            </div>
          ) : tab === "opacity" ? (
            <div className="p-4"><Field label="Opacity (%)" value={Math.round(el.params.opacity * 100)} onChange={(v) => updateParams(el.id, { opacity: Math.max(0, Math.min(100, v)) / 100 })} /></div>
          ) : tab === "layers" ? (
            <div className="p-4"><Field label="Z-index" value={el.params.zIndex} onChange={(v) => updateParams(el.id, { zIndex: v })} /></div>
          ) : (
            <div className="px-6 py-10 text-center text-sm capitalize text-slate-400">{tab} — coming soon.</div>
          )}
        </div>
      )}
    </aside>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-xs text-slate-500"><I.diamond width={11} height={11} className="text-slate-300" />{label}</span>
      <input type="number" value={value} onChange={(e) => { const v = parseFloat(e.target.value); onChange(Number.isNaN(v) ? 0 : v); }} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:bg-white" />
    </label>
  );
}
