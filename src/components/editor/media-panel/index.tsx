"use client";

import { usePanelStore } from "@/stores/panel-store";
import { MediaView } from "./views/media-view";
import { SettingsView } from "./views/settings-view";
import { InspectorView } from "./views/inspector-view";
import { I } from "../icons";

const TITLES: Record<string, string> = {
  text: "Text", stickers: "Stickers", effects: "Effects",
  transitions: "Transitions", captions: "Captions", adjust: "Adjust",
};

const NAVIGATION = [
  { key: "media" as const, label: "Assets", Icon: I.folder },
  { key: "library" as const, label: "Library", Icon: I.layers },
  { key: "transcript" as const, label: "Transcript", Icon: I.captions },
  { key: "inspector" as const, label: "Inspector", Icon: I.adjust },
];

export function MediaPanel() {
  const active = usePanelStore((s) => s.active);
  const setActive = usePanelStore((s) => s.setActive);
  return (
    <aside className="flex h-full w-full min-w-0 flex-col bg-[#edebe8]">
      <nav aria-label="Editor panel" className="flex h-10 shrink-0 items-center gap-1 border-b border-[#c9c7c2] px-3">
        {NAVIGATION.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active === key}
            onClick={() => setActive(key)}
            className={`flex h-7 w-7 items-center justify-center rounded-sm transition ${active === key ? "bg-[#d8d5d0] text-[#292724]" : "text-[#716d67] hover:bg-[#e4e1dd] hover:text-[#292724]"}`}
          >
            <Icon width={17} height={17} />
          </button>
        ))}
        <button
          type="button"
          title="Project settings"
          aria-label="Project settings"
          aria-pressed={active === "settings"}
          onClick={() => setActive("settings")}
          className={`ml-auto flex h-7 w-7 items-center justify-center rounded-sm transition ${active === "settings" ? "bg-[#d8d5d0] text-[#292724]" : "text-[#716d67] hover:bg-[#e4e1dd] hover:text-[#292724]"}`}
        >
          <I.settings width={17} height={17} />
        </button>
      </nav>
      {active === "media" && <MediaView />}
      {active === "audio" && <MediaView audioOnly />}
      {active === "settings" && (
        <div className="min-h-0 flex-1"><SettingsView /></div>
      )}
      {active === "inspector" && <InspectorView />}
      {active !== "media" && active !== "audio" && active !== "settings" && active !== "inspector" && (
        <>
          <div className="border-b border-slate-200 px-4 py-3 text-[15px] font-semibold text-slate-800">{TITLES[active]}</div>
          <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-400">{TITLES[active]} panel coming soon.</div>
        </>
      )}
    </aside>
  );
}
