import type { Metadata } from "next";
import { DocHeader, H2, P, Code, Callout, NextCard } from "@/components/docs/doc-ui";

export const metadata: Metadata = {
  title: "Cursor",
  description: "Use ShiftCut inside Cursor — install the skills and edit video from the composer.",
};

export default function Cursor() {
  return (
    <>
      <DocHeader
        eyebrow="Agents"
        title="Cursor"
        intro="Drive ShiftCut from Cursor's composer. Reference a video and describe the edit — Cursor runs the operations against the local engine."
      />
      <H2>Install</H2>
      <Code>{`$ shiftcut add cursor`}</Code>
      <P>Reload Cursor so it picks up the ShiftCut tools.</P>
      <H2>Make an edit</H2>
      <Code>{`@media/interview.mp4 cut this into 5 shorts with
captions and export vertical`}</Code>
      <Callout title="Same engine, same results">
        Cursor and Claude Code drive the identical deterministic engine. A
        project started in one continues cleanly in the other.
      </Callout>
      <NextCard href="/docs/agents/codex" label="Codex" />
    </>
  );
}
