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
    "Install ShiftCut, connect it to your coding agent, and make your first edit — turn a video into shorts from a single prompt.",
};

export default function Quickstart() {
  return (
    <>
      <DocHeader
        eyebrow="Getting started"
        title="Quickstart"
        intro="Go from a raw video to a finished edit in a few minutes. You'll install ShiftCut, wire it into your agent, and run your first edit from a prompt."
      />

      <Callout title="Prerequisites">
        Node.js 20.9+ and FFmpeg on your PATH. Whisper.cpp and a headless
        Chromium are fetched on first use. Everything runs locally — no account
        required.
      </Callout>

      <Steps>
        <Step title="Install the CLI">
          <P>Scaffold a project and pull in the local editing engine:</P>
          <Code>{`$ npx shiftcut init my-edits
$ cd my-edits`}</Code>
        </Step>

        <Step title="Add ShiftCut to your agent">
          <P>
            Register ShiftCut&apos;s skills with your coding agent. This exposes
            the editing engine as tools the agent can plan against:
          </P>
          <Code>{`$ npx shiftcut add claude-code
# also: cursor · codex · gemini-cli`}</Code>
          <P>
            Restart your agent so it picks up the new commands. In Claude Code,
            start a request with <code>/shiftcut</code>.
          </P>
        </Step>

        <Step title="Drop in a video">
          <P>Put any file in the project — or point at one anywhere on disk:</P>
          <Code>{`my-edits/
├── shiftcut.json      # project + engine config
├── media/
│   └── interview.mp4  # your footage
└── out/               # rendered results`}</Code>
        </Step>

        <Step title="Describe the edit">
          <P>Tell your agent what you want in plain language:</P>
          <Code>{`❯ open media/interview.mp4 and cut it into 5 shorts,
  add captions, and export vertical`}</Code>
          <P>
            ShiftCut transcribes locally, finds the strongest moments, reframes
            to 9:16, styles captions, and renders — reporting each operation so
            the agent (and you) can inspect and adjust.
          </P>
        </Step>

        <Step title="Iterate conversationally">
          <P>
            Don&apos;t re-prompt from scratch. Refine the same project like
            you&apos;d talk to an editor:
          </P>
          <Code>{`❯ make short-02 punchier and trim the intro
❯ use Hormozi-style captions instead
❯ re-render just the vertical exports`}</Code>
        </Step>
      </Steps>

      <H2>Prefer the CLI?</H2>
      <P>
        Every agent action maps to a scriptable command, so the same edit runs
        headless in CI or a batch job:
      </P>
      <Code>{`$ shiftcut edit media/interview.mp4 \\
    --shorts 5 --captions hormozi --aspect 9:16 \\
    --out out/`}</Code>

      <Callout tone="muted" title="Same result, every time">
        A project always produces the same edit. Commit{" "}
        <code>shiftcut.json</code> and your whole team gets the exact same
        result — on any machine.
      </Callout>

      <NextCard href="/docs/installation" label="Installation — full setup" />
    </>
  );
}
