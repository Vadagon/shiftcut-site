import type { Metadata } from "next";
import {
  DocHeader,
  H2,
  P,
  Callout,
  NextCard,
} from "@/components/docs/doc-ui";

export const metadata: Metadata = {
  title: "Introduction",
  description:
    "ShiftCut lets your AI edit your videos. Open any video, tell your coding agent what you want, and it does the editing on your machine.",
};

export default function DocsIntro() {
  return (
    <>
      <DocHeader
        eyebrow="Getting started"
        title="Introduction"
        intro="ShiftCut lets your AI edit your videos. Open any video, tell your coding agent what you want, and it does the editing — right on your machine."
      />

      <P>
        With a traditional editor, <strong>you</strong> do the editing — the
        cutting, the captioning, the exporting. With ShiftCut, you just{" "}
        <strong>describe what you want</strong> and your agent does it for you.
        Think of it as CapCut on autopilot.
      </P>

      <P>
        Point <a href="/docs/agents/claude-code">Claude Code</a>, Cursor, Codex,
        or Gemini CLI at a video and ask in plain language: &quot;cut this into
        five shorts,&quot; &quot;add captions,&quot; &quot;make it
        vertical.&quot; ShiftCut watches the footage, makes the edits, and hands
        you finished files.
      </P>

      <Callout title="The whole idea">
        You bring a video and say what you want. Your AI handles the rest — no
        timeline to scrub, no keyframes to nudge, no software to learn.
      </Callout>

      <H2>What you can do</H2>
      <P>
        ShiftCut is built for making footage you already have better — the same
        things you&apos;d open CapCut for, just spoken instead of clicked:
      </P>
      <ul className="my-4 space-y-2 text-fg-muted">
        {[
          "Turn a podcast or interview into short-form clips",
          "Remove filler words, silences, and awkward pauses",
          "Add styled, synced captions and reframe to vertical",
          "Generate a trailer or highlight reel from long footage",
          "Replace backgrounds, swap audio, translate, and restyle",
        ].map((t) => (
          <li key={t} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            {t}
          </li>
        ))}
      </ul>

      <P>
        Need something from scratch? ShiftCut <strong>can</strong> also build
        intros, motion graphics, and explainers on request. But making real
        footage better is what it does first and best.
      </P>

      <H2>What makes it different</H2>
      <ul className="my-4 space-y-2 text-fg-muted">
        {[
          "You just talk to it — no editing skills required.",
          "It runs on your machine, so your footage stays private.",
          "It's free and open source (Apache-2.0) — no subscriptions or watermarks.",
          "It works inside the agent you already use, or in a visual studio.",
        ].map((t) => (
          <li key={t} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            {t}
          </li>
        ))}
      </ul>

      <NextCard href="/docs/quickstart" label="Quickstart — your first edit" />
    </>
  );
}
