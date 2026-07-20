import type { Metadata } from "next";
import {
  DocHeader,
  H2,
  P,
  Code,
  Callout,
  Steps,
  Step,
  NextCard,
} from "@/components/docs/doc-ui";

export const metadata: Metadata = {
  title: "Quickstart",
  description:
    "Add ShiftCut to your coding agent and make your first edit — turn a video into shorts from a single prompt.",
};

export default function Quickstart() {
  return (
    <>
      <DocHeader
        eyebrow="Getting started"
        title="Quickstart"
        intro="Go from a raw video to a finished edit in a few minutes. Add the skill to your agent, point it at a file, and describe what you want."
      />

      <Callout title="Prerequisites">
        Node.js 22+ and FFmpeg on your PATH. Whisper.cpp and a headless Chromium
        are fetched on first use. Everything runs locally — no account required.
      </Callout>

      <Steps>
        <Step title="Add the skill to your agent">
          <P>One command installs ShiftCut for your coding agent:</P>
          <Code>{`$ npx skills add Vadagon/shiftcut`}</Code>
        </Step>

        <Step title="Restart your agent">
          <P>
            Reload your agent so it picks up the skill. In Claude Code, start a
            message with <code>/shiftcut</code> to load the editing context.
          </P>
        </Step>

        <Step title="Point it at a video">
          <P>
            No project to scaffold — just reference any file you already have:
          </P>
          <Code>{`❯ /shiftcut open interview.mp4`}</Code>
          <P>
            ShiftCut watches the footage locally — transcript, scenes, and
            silences — so it can edit against what&apos;s actually there.
          </P>
        </Step>

        <Step title="Describe the edit">
          <P>Tell your agent what you want in plain language:</P>
          <Code>{`❯ cut it into 5 shorts, add captions, and export vertical`}</Code>
          <P>
            ShiftCut finds the strongest moments, reframes to 9:16, styles
            captions, and renders — telling you what it did so you can adjust.
          </P>
        </Step>

        <Step title="Iterate conversationally">
          <P>
            Don&apos;t re-prompt from scratch. Refine like you&apos;d talk to an
            editor:
          </P>
          <Code>{`❯ make short-02 punchier and trim the intro
❯ use bolder captions instead
❯ re-render just the vertical exports`}</Code>
        </Step>
      </Steps>

      <H2>Prefer the terminal?</H2>
      <P>
        The same edits run headless from the CLI, so they drop straight into
        scripts and CI:
      </P>
      <Code>{`$ shiftcut render --out out/`}</Code>

      <Callout tone="muted" title="Same result, every time">
        A composition always renders the same. Commit the project folder and
        your whole team gets the exact same result — on any machine.
      </Callout>

      <NextCard href="/docs/installation" label="Installation — full setup" />
    </>
  );
}
