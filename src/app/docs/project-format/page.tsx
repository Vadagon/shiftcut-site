import type { Metadata } from "next";
import { DocHeader, H2, P, Code, ComingSoon } from "@/components/docs/doc-ui";

export const metadata: Metadata = {
  title: "Project format",
  description:
    "The shiftcut.json project format — a plain, diffable, version-controllable source of truth for deterministic renders.",
};

export default function ProjectFormat() {
  return (
    <>
      <DocHeader
        eyebrow="Reference"
        title="Project format"
        intro="A ShiftCut project is a plain, diffable file. Commit it and anyone gets the exact same render."
      />

      <ComingSoon />

      <H2>Shape</H2>
      <P>
        <code>shiftcut.json</code> declares sources, the ordered edit graph, and
        render settings. It&apos;s designed to be readable by humans, agents,
        and version control alike:
      </P>
      <Code>{`{
  "version": 1,
  "sources": {
    "interview": "media/interview.mp4"
  },
  "edits": [
    { "op": "remove-silences", "source": "interview" },
    { "op": "captions", "style": "hormozi" },
    { "op": "reframe", "aspect": "9:16" },
    { "op": "shorts", "count": 5 }
  ],
  "render": { "out": "out/", "fps": 30 }
}`}</Code>

      <P>
        Because the render is a pure function of this file, the same project
        produces byte-identical output on any machine.
      </P>
    </>
  );
}
