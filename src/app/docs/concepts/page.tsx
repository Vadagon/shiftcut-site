import type { Metadata } from "next";
import { DocHeader, H2, P, Code, Callout, NextCard } from "@/components/docs/doc-ui";

export const metadata: Metadata = {
  title: "Core concepts",
  description:
    "How UltraCut works under the hood: HTML compositions, clips and tracks, the paused timeline, understanding, and the local render.",
};

export default function Concepts() {
  return (
    <>
      <DocHeader
        eyebrow="Getting started"
        title="Core concepts"
        intro="A quick tour of what your agent actually works with when it edits — and why every render comes out the same."
      />

      <H2>Compositions are HTML</H2>
      <P>
        A UltraCut project is a small web project. The edit lives in an{" "}
        <code>index.html</code> your agent reads and writes — clips, captions,
        titles, and motion are plain HTML, CSS, and JS. That&apos;s why an agent
        is so good at it: editing video becomes editing markup it fully
        understands.
      </P>
      <Code>{`<div data-composition-id="my-edit" data-width="1080" data-height="1920">
  <video class="clip" src="assets/interview.mp4"
         data-start="0" data-duration="32" data-track-index="0"></video>
  <div class="clip caption" data-start="1.2" data-duration="2.5"
       data-track-index="1">the part nobody expects</div>
</div>`}</Code>

      <H2>Clips &amp; tracks</H2>
      <P>
        Anything timed is a <code>clip</code> — a slice of your source video, a
        caption, a title, an overlay. Each clip carries{" "}
        <code>data-start</code>, <code>data-duration</code>, and{" "}
        <code>data-track-index</code>, so clips stack into tracks on a timeline,
        exactly like a normal editor.
      </P>

      <H2>One paused timeline</H2>
      <P>
        Motion is a single GSAP timeline built <code>{`{ paused: true }`}</code>{" "}
        and registered on <code>window.__timelines</code>. Because it&apos;s
        paused and seek-safe, UltraCut can jump to any frame and render it
        precisely — no guesswork, no drift.
      </P>

      <H2>Understanding your footage</H2>
      <P>
        Before it edits, UltraCut reads the video. Transcripts, scene
        boundaries, faces, and silences are analyzed <strong>locally</strong>{" "}
        (Whisper.cpp, OpenCV) so the agent can place cuts and captions against
        what&apos;s actually in the footage — not guesses.
      </P>

      <H2>The render is deterministic</H2>
      <Callout title="Same composition, same output">
        Rendering is a pure function of the composition. Headless Chromium and
        FFmpeg produce the same frames for the same project — on your laptop, a
        teammate&apos;s, or CI. (The AI&apos;s editing choices are a separate,
        creative step; the render of a given composition is always reproducible.)
      </Callout>

      <NextCard href="/docs/agents/claude-code" label="Using UltraCut with Claude Code" />
    </>
  );
}
