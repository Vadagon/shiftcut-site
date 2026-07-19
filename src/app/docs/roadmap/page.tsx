import type { Metadata } from "next";
import { DocHeader, P } from "@/components/docs/doc-ui";

export const metadata: Metadata = {
  title: "Roadmap",
  description: "Where ShiftCut is headed — editing depth, surfaces, and the agent ecosystem.",
};

const phases = [
  {
    tag: "Now",
    title: "The editor",
    items: [
      "Local understanding: transcribe, scene & silence detection",
      "First edits: shorts, captions, remove-silences, reframe",
      "Claude Code skill, plus Cursor, Codex, and Gemini CLI",
      "Live browser preview + reproducible local render",
    ],
  },
  {
    tag: "Next",
    title: "Depth",
    items: [
      "Wider edit catalog: cut/reorder/retime, titles, transitions, color",
      "Replace-background and replace-audio (all local)",
      "Reusable templates and workflows",
    ],
  },
  {
    tag: "Later",
    title: "Surfaces",
    items: [
      "Browser Studio — a CapCut-style visual timeline",
      "An embeddable API for your own product or pipeline",
      "An open catalog of community styles and blocks",
    ],
  },
];

export default function Roadmap() {
  return (
    <>
      <DocHeader
        eyebrow="Reference"
        title="Roadmap"
        intro="ShiftCut is early and moving fast. Editing depth comes first; surfaces and platform follow."
      />

      <P>
        The through-line never changes: one local, reproducible editor that any
        agent can drive. Here&apos;s the shape of what&apos;s
        coming.
      </P>

      <div className="my-8 space-y-4">
        {phases.map((phase) => (
          <div
            key={phase.tag}
            className="rounded-xl border border-border bg-surface/40 p-5"
          >
            <div className="flex items-center gap-3">
              <span className="rounded-md bg-accent-soft px-2 py-0.5 font-mono text-xs text-accent">
                {phase.tag}
              </span>
              <h3 className="text-[15px] font-semibold text-fg">
                {phase.title}
              </h3>
            </div>
            <ul className="mt-3 space-y-2">
              {phase.items.map((it) => (
                <li key={it} className="flex gap-3 text-sm text-fg-muted">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-fg-subtle" />
                  {it}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
