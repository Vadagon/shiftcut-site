import type { Metadata } from "next";
import { DocHeader, H2, P, ComingSoon, NextCard } from "@/components/docs/doc-ui";

export const metadata: Metadata = {
  title: "Editing operations",
  description:
    "The edits ShiftCut can make to a composition — cutting, understanding, captioning, transforming, and exporting. All local.",
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
    ops: ["captions", "titles", "transitions", "color"],
  },
  {
    title: "Transform",
    ops: ["reframe", "remove-background", "replace-audio"],
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
        intro="The edits your agent makes to a composition. Each one is a change to the project — your source files are never touched — and runs entirely on your machine."
      />

      <ComingSoon />

      <P>
        First to ship: <strong>shorts</strong>, <strong>captions</strong>,{" "}
        <strong>remove-silences</strong>, and <strong>reframe</strong>. The
        wider catalog it will document:
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

      <P>
        Need something from scratch — an intro, a title card, motion graphics?
        ShiftCut builds those as compositions too. Editing real footage comes
        first; generation follows.
      </P>

      <NextCard href="/docs/project-format" label="Project format" />
    </>
  );
}
