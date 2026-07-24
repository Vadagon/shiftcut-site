import type { Metadata } from "next";
import { DocHeader, H2, P, Callout, ComingSoon, NextCard } from "@/components/docs/doc-ui";

export const metadata: Metadata = {
  title: "Browser Studio",
  description:
    "Browser Studio is UltraCut's visual timeline — it feels like CapCut, and every manual edit is the same operation your agent runs.",
};

export default function Studio() {
  return (
    <>
      <DocHeader
        eyebrow="Surfaces"
        title="Browser Studio"
        intro="A visual timeline for when you want to nudge by hand. It'll feel like CapCut — and drive the exact same project as your agent."
      />

      <ComingSoon />

      <P>
        Today UltraCut ships a <strong>live browser preview</strong> — run{" "}
        <code>ultracut preview</code> to watch a composition update as your agent
        edits it. The full CapCut-style visual timeline below is on the roadmap.
      </P>

      <H2>Why a visual surface</H2>
      <P>
        Agents handle the heavy lifting, but sometimes you want to drag a clip,
        retime a caption, or preview a cut yourself. Browser Studio will give you
        that timeline without leaving the UltraCut model.
      </P>

      <Callout title="One model, two hands">
        Every manual edit in Studio is just a change to the same{" "}
        <a href="/docs/project-format">composition</a> your agent edits. Hand a
        project back to Claude Code and it picks up exactly where you left off —
        no translation, no drift.
      </Callout>

      <H2>What it will cover</H2>
      <ul className="my-4 space-y-2 text-fg-muted">
        {[
          "Timeline with tracks, clips, and frame-accurate scrubbing",
          "Live preview backed by the real editing engine",
          "Caption, reframe, and transition editing",
          "Round-tripping edits to and from your agent",
        ].map((t) => (
          <li key={t} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            {t}
          </li>
        ))}
      </ul>

      <NextCard href="/docs/api" label="API" />
    </>
  );
}
