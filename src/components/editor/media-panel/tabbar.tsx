"use client";

import { usePanelStore, type PanelKey } from "@/stores/panel-store";
import { cn } from "@/lib/utils";
import { I } from "../icons";

const ITEMS: { key: PanelKey; label: string; Icon: typeof I.folder }[] = [
  { key: "media", label: "Media", Icon: I.folder },
  { key: "audio", label: "Audio", Icon: I.audio },
  { key: "text", label: "Text", Icon: I.text },
  { key: "stickers", label: "Stickers", Icon: I.sticker },
  { key: "effects", label: "Effects", Icon: I.effects },
  { key: "transitions", label: "Transitions", Icon: I.transitions },
  { key: "captions", label: "Captions", Icon: I.captions },
  { key: "adjust", label: "Adjust", Icon: I.adjust },
  { key: "settings", label: "Settings", Icon: I.settings },
];

export function Tabbar() {
  const active = usePanelStore((s) => s.active);
  const setActive = usePanelStore((s) => s.setActive);
  return (
    <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-slate-200 bg-white py-3">
      {ITEMS.map(({ key, label, Icon }) => (
        <button
          key={key}
          title={label}
          onClick={() => setActive(key)}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg transition",
            active === key ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600",
          )}
        >
          <Icon width={20} height={20} />
        </button>
      ))}
    </nav>
  );
}
