import type { Metadata } from "next";
import { DocHeader, H2, P, Code, Callout, NextCard } from "@/components/docs/doc-ui";

export const metadata: Metadata = {
  title: "Claude Code",
  description:
    "Use ShiftCut with Claude Code — install the skills, drive edits from prompts, and iterate conversationally.",
};

export default function ClaudeCode() {
  return (
    <>
      <DocHeader
        eyebrow="Agents"
        title="Claude Code"
        intro="Claude Code is a first-class surface for ShiftCut. The code experience feels like Cursor; the editing power feels like CapCut."
      />

      <H2>Install</H2>
      <Code>{`$ npx skills add shiftcut/shiftcut`}</Code>
      <P>
        Restart Claude Code, then start any request with <code>/shiftcut</code>{" "}
        to load the editing context.
      </P>

      <H2>Make an edit</H2>
      <P>Describe intent — Claude plans operations and runs them:</P>
      <Code>{`❯ /shiftcut open media/talk.mp4, remove filler words,
  and make a 60s highlight for LinkedIn`}</Code>

      <Callout title="It reasons about your footage">
        Because ShiftCut exposes transcripts, scenes, and silences as structured
        state, Claude edits against what&apos;s actually in the video instead of
        guessing at timestamps.
      </Callout>

      <H2>Iterate</H2>
      <P>Keep the conversation going instead of re-prompting:</P>
      <Code>{`❯ tighten the opening
❯ bump caption size and use the brand font
❯ export a 9:16 version too`}</Code>

      <H2>Good prompts</H2>
      <P>
        Name the source, the outcome, and any style. &quot;Turn talk.mp4 into
        three 30s shorts with bold captions&quot; beats &quot;make shorts.&quot;
        See <a href="/docs/agents/prompting">Prompting</a> for the full
        vocabulary.
      </P>

      <NextCard href="/docs/agents/prompting" label="Prompting patterns" />
    </>
  );
}
