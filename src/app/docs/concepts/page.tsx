import type { Metadata } from "next";
import { DocHeader, H2, P, Code, Callout, NextCard } from "@/components/docs/doc-ui";

export const metadata: Metadata = {
  title: "Core concepts",
  description:
    "The ShiftCut model: projects, sources, operations, the timeline, and deterministic renders.",
};

export default function Concepts() {
  return (
    <>
      <DocHeader
        eyebrow="Getting started"
        title="Core concepts"
        intro="A quick tour of the pieces an agent reasons about when it edits with ShiftCut."
      />

      <H2>Project</H2>
      <P>
        A project is a directory with a <code>shiftcut.json</code> describing
        sources, the edit graph, and render settings. It&apos;s plain,
        diffable, and version-controllable — the single source of truth for a
        deterministic render.
      </P>

      <H2>Sources</H2>
      <P>
        Sources are your input media — video, audio, images. ShiftCut{" "}
        <strong>understands</strong> them: transcripts, scene boundaries,
        speakers, and silences are analyzed locally so the agent can plan edits
        against real structure rather than guesses.
      </P>

      <H2>Operations</H2>
      <P>
        Every edit is an <strong>operation</strong> — cut, trim, reorder,
        reframe, caption, retime, replace-background, export. Operations are
        non-destructive, composable, and repeatable. This is what makes ShiftCut
        agent-friendly: the model plans a sequence of operations, not pixels.
      </P>
      <Code>{`{
  "op": "captions",
  "style": "hormozi",
  "source": "interview.mp4",
  "range": "auto"
}`}</Code>

      <H2>Timeline</H2>
      <P>
        Operations resolve onto a timeline of tracks and clips. You can inspect
        it, hand-edit it in <a href="/docs/studio">Browser Studio</a>, or let
        the agent manage it entirely.
      </P>

      <H2>Deterministic render</H2>
      <Callout title="Same input, same bytes">
        Rendering is a pure function of the project. FFmpeg and headless
        Chromium produce identical output for identical input — on your laptop,
        a teammate&apos;s, or CI.
      </Callout>

      <NextCard href="/docs/agents/claude-code" label="Using ShiftCut with Claude Code" />
    </>
  );
}
