"use client";

import { useEffect, useRef, useState } from "react";

type Step =
  | { kind: "prompt"; text: string }
  | { kind: "log"; text: string; accent?: boolean }
  | { kind: "result"; items: string[] };

const SCRIPT: Step[] = [
  { kind: "prompt", text: "open interview.mp4 and cut it into 5 shorts" },
  { kind: "log", text: "▸ watching the video…" },
  { kind: "log", text: "▸ picking the 5 best moments…" },
  { kind: "log", text: "▸ reframing to vertical, adding captions…" },
  { kind: "log", text: "▸ exporting on your machine…" },
  { kind: "log", text: "✓ 5 shorts ready in ./out", accent: true },
  {
    kind: "result",
    items: [
      "short-01 · 0:32 · “the part nobody expects”",
      "short-02 · 0:41 · “how we shipped it”",
      "short-03 · 0:28 · “the mistake”",
    ],
  },
];

export function TerminalDemo() {
  const [visible, setVisible] = useState(0); // number of steps revealed
  const [typed, setTyped] = useState(""); // typed chars of the prompt
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const promptText = (SCRIPT[0] as { text: string }).text;

    // Type the prompt out.
    let i = 0;
    const typeNext = () => {
      i += 1;
      setTyped(promptText.slice(0, i));
      if (i < promptText.length) {
        timers.push(setTimeout(typeNext, 34));
      } else {
        setVisible(1);
        // Reveal the rest of the steps on a cadence.
        for (let s = 1; s < SCRIPT.length; s++) {
          timers.push(
            setTimeout(() => setVisible(s + 1), 600 + (s - 1) * 780),
          );
        }
      }
    };
    timers.push(setTimeout(typeNext, 650));

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="glow-accent overflow-hidden rounded-xl border border-border bg-[#0c0c0e]">
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-surface/60 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="ml-2 font-mono text-xs text-fg-subtle">
          claude-code — ultracut
        </span>
      </div>

      <div className="min-h-[288px] px-4 py-4 font-mono text-[13px] leading-relaxed">
        {/* prompt line */}
        <div className="flex gap-2">
          <span className="select-none text-accent">❯</span>
          <span className="text-fg">
            {typed}
            {visible === 0 && <span className="caret text-accent">▋</span>}
          </span>
        </div>

        {/* agent output */}
        <div className="mt-2 space-y-1.5">
          {SCRIPT.slice(1).map((step, idx) => {
            const shown = visible > idx + 1;
            if (!shown) return null;
            if (step.kind === "log") {
              return (
                <div
                  key={idx}
                  className={`animate-rise ${
                    step.accent ? "text-accent" : "text-fg-muted"
                  }`}
                >
                  {step.text}
                </div>
              );
            }
            if (step.kind !== "result") return null;
            return (
              <div
                key={idx}
                className="animate-rise mt-3 space-y-1 rounded-lg border border-border bg-surface/40 p-3"
              >
                {step.items.map((it) => (
                  <div key={it} className="text-fg-muted">
                    <span className="text-amber">◆</span> {it}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
