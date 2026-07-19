import type { Metadata } from "next";
import { DocHeader, H2, P, Code, Callout } from "@/components/docs/doc-ui";

export const metadata: Metadata = {
  title: "Project format",
  description:
    "A ShiftCut project is a small web project — meta.json, an index.html composition, compositions, and assets. Plain, diffable, reproducible.",
};

export default function ProjectFormat() {
  return (
    <>
      <DocHeader
        eyebrow="Reference"
        title="Project format"
        intro="A ShiftCut project is a small web project on disk. It's plain text, so it diffs cleanly and renders the same everywhere."
      />

      <H2>Layout</H2>
      <Code>{`my-edit/
├── meta.json         # project metadata (title, size, fps)
├── index.html        # the composition — clips, captions, motion
├── compositions/     # reusable sub-compositions
└── assets/           # your source video, audio, images`}</Code>

      <H2>The composition</H2>
      <P>
        <code>index.html</code> is the edit. Timed elements use{" "}
        <code>class="clip"</code> with <code>data-start</code>,{" "}
        <code>data-duration</code>, and <code>data-track-index</code>; the root
        declares <code>data-composition-id</code>, <code>data-width</code>, and{" "}
        <code>data-height</code>. Motion is a single paused GSAP timeline
        registered on <code>window.__timelines</code>. See{" "}
        <a href="/docs/concepts">Core concepts</a> for the full model.
      </P>

      <Callout title="Reproducible by design">
        Because the render is a pure function of these files, the same project
        produces the same output on any machine. Commit the folder and your
        whole team gets identical results.
      </Callout>

      <P>
        This is the same technical model as HyperFrames — ShiftCut keeps it and
        adds the local understanding and editing layer on top.
      </P>
    </>
  );
}
