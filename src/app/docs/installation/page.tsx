import type { Metadata } from "next";
import {
  DocHeader,
  H2,
  P,
  Code,
  Callout,
  NextCard,
} from "@/components/docs/doc-ui";

export const metadata: Metadata = {
  title: "Installation",
  description:
    "Install ShiftCut as a skill for your coding agent and set up its local tools — FFmpeg, Whisper.cpp, Chromium, and OpenCV.",
};

export default function Installation() {
  return (
    <>
      <DocHeader
        eyebrow="Getting started"
        title="Installation"
        intro="ShiftCut runs entirely on your machine. Install the skill for your agent, make sure FFmpeg is present, and you're ready."
      />

      <H2>Requirements</H2>
      <P>
        Node.js 22+ and FFmpeg are required. Whisper.cpp (transcription),
        Chromium (rendering &amp; motion), and OpenCV (scene analysis) are
        managed for you and downloaded on first use. Everything runs locally —
        no account, no cloud.
      </P>

      <H2>Add the skill</H2>
      <P>
        ShiftCut installs as a skill for your coding agent. One command works
        across every supported tool:
      </P>
      <Code>{`$ npx skills add Vadagon/shiftcut`}</Code>
      <P>
        Restart your agent so it loads the skill. In Claude Code, start a
        message with <code>/shiftcut</code>. See the{" "}
        <a href="/docs/agents/claude-code">agent guides</a> for the per-tool
        step.
      </P>

      <H2>Install FFmpeg</H2>
      <Code>{`# macOS
$ brew install ffmpeg

# Debian / Ubuntu
$ sudo apt install ffmpeg

# Windows (winget)
$ winget install Gyan.FFmpeg`}</Code>

      <Callout title="Verify your setup">
        Run <code>shiftcut doctor</code> to check versions and confirm FFmpeg,
        Whisper.cpp, and Chromium are reachable before your first edit.
      </Callout>

      <H2>Offline &amp; CI</H2>
      <P>
        Because everything is local, ShiftCut runs fully offline and in CI.
        Cache the tools once and every render is reproducible across runners.
      </P>

      <NextCard href="/docs/concepts" label="Core concepts" />
    </>
  );
}
