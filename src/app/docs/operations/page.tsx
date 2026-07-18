import type { Metadata } from "next";
import { DocHeader, H2, P, ComingSoon, NextCard } from "@/components/docs/doc-ui";

export const metadata: Metadata = {
  title: "Editing operations",
  description:
    "The catalog of ShiftCut editing operations — the composable building blocks agents plan against.",
};

const groups = [
  {
    title: "Cut & arrange",
    ops: ["trim", "cut", "reorder", "split", "join", "retime"],
  },
  {
    title: "Understand",
    ops: ["transcribe", "detect-scenes", "detect-silences", "find-highlights"],
  },
  {
    title: "Style & caption",
    ops: ["captions", "titles", "transitions", "restyle", "color"],
  },
  {
    title: "Transform",
    ops: ["reframe", "remove-background", "replace-audio", "translate", "upscale"],
  },
  {
    title: "Output",
    ops: ["shorts", "highlight", "export", "render"],
  },
];

export default function Operations() {
  return (
    <>
      <DocHeader
        eyebrow="Reference"
        title="Editing operations"
        intro="Operations are the composable building blocks of every edit. Agents plan sequences of them; you can too."
      />

      <ComingSoon />

      <P>
        Each operation is non-destructive and repeatable, with typed inputs and
        structured results. The catalog it will document:
      </P>

      <div className="my-8 grid gap-4 sm:grid-cols-2">
        {groups.map((g) => (
          <div
            key={g.title}
            className="rounded-xl border border-border bg-surface/40 p-5"
          >
            <h3 className="text-sm font-semibold text-fg">{g.title}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {g.ops.map((op) => (
                <span
                  key={op}
                  className="rounded-md border border-border px-2 py-0.5 font-mono text-[12px] text-fg-muted"
                >
                  {op}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <NextCard href="/docs/project-format" label="Project format" />
    </>
  );
}
