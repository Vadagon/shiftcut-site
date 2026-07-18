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
    "Install ShiftCut and its local dependencies — FFmpeg, Whisper.cpp, Chromium, and OpenCV — on macOS, Linux, or Windows.",
};

export default function Installation() {
  return (
    <>
      <DocHeader
        eyebrow="Getting started"
        title="Installation"
        intro="ShiftCut runs on your machine. Here's how to install the CLI and the local engine dependencies."
      />

      <H2>Requirements</H2>
      <P>
        Node.js 20.9+ and FFmpeg are required. Whisper.cpp (transcription),
        Chromium (motion &amp; compositing), and OpenCV (scene analysis) are
        managed for you and downloaded on first use.
      </P>

      <H2>Install the CLI</H2>
      <Code>{`# one-off
$ npx shiftcut init my-edits

# or install globally
$ npm i -g shiftcut
$ shiftcut init my-edits`}</Code>

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

      <H2>Connect an agent</H2>
      <P>Register the editing skills with the agent you use:</P>
      <Code>{`$ shiftcut add claude-code
$ shiftcut add cursor
$ shiftcut add codex
$ shiftcut add gemini-cli`}</Code>
      <P>
        Restart the agent afterward so it loads the new commands. See the{" "}
        <a href="/docs/agents/claude-code">agent guides</a> for per-agent
        details.
      </P>

      <H2>Offline &amp; CI</H2>
      <P>
        Because everything is local and deterministic, ShiftCut runs fully
        offline and in CI. Cache the engine dependencies once and renders are
        reproducible across runners.
      </P>

      <NextCard href="/docs/concepts" label="Core concepts" />
    </>
  );
}
