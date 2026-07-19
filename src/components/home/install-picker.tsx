"use client";

import { useState } from "react";
import { installCommand, installTargets } from "@/lib/site";

export function InstallPicker() {
  const [active, setActive] =
    useState<(typeof installTargets)[number]["id"]>(installTargets[0].id);
  const [copied, setCopied] = useState(false);
  const target =
    installTargets.find((t) => t.id === active) ?? installTargets[0];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(installCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — no-op */
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* tool tabs */}
      <div
        role="tablist"
        aria-label="Choose your tool"
        className="flex flex-wrap gap-2"
      >
        {installTargets.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setActive(t.id);
                setCopied(false);
              }}
              className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
                selected
                  ? "border-accent/40 bg-accent-soft text-accent"
                  : "border-border text-fg-muted hover:border-border-strong hover:text-fg"
              }`}
            >
              {t.name}
            </button>
          );
        })}
      </div>

      {/* command card */}
      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-[#0c0c0e]">
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <code className="min-w-0 truncate font-mono text-[15px]">
            <span className="select-none text-fg-subtle">$ </span>
            <span className="text-fg">{installCommand}</span>
          </code>
          <button
            onClick={copy}
            className="shrink-0 rounded-md border border-border px-2.5 py-1.5 font-mono text-xs text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
          >
            {copied ? "copied ✓" : "copy"}
          </button>
        </div>
        <div className="border-t border-border bg-surface/40 px-4 py-2.5">
          <p className="text-[13px] text-fg-muted">
            <span className="text-accent">→</span> {target.note}
          </p>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-fg-subtle">
        One command adds the skill to every tool. Then just open a video and
        say what you want.
      </p>
    </div>
  );
}
