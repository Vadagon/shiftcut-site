import type { Metadata } from "next";
import { DocHeader, H2, P, Code, Callout, NextCard } from "@/components/docs/doc-ui";

export const metadata: Metadata = {
  title: "API",
  description:
    "Embed ShiftCut's deterministic editing engine into your own product, server, or pipeline.",
};

export default function Api() {
  return (
    <>
      <DocHeader
        eyebrow="Surfaces"
        title="API"
        intro="The same editing power behind Claude Code and Browser Studio, as a library you can drop into your own product or pipeline."
      />

      <H2>Programmatic edits</H2>
      <P>
        Build and render projects in code. The API mirrors the operation model,
        so anything an agent can do, your app can do:
      </P>
      <Code>{`import { ShiftCut } from "shiftcut";

const project = ShiftCut.open("media/interview.mp4");

await project
  .removeSilences()
  .captions({ style: "hormozi" })
  .reframe("9:16")
  .shorts(5)
  .render("out/");`}</Code>

      <Callout title="Private & repeatable">
        Runs on your own infrastructure. No footage leaves your machine unless
        you opt into a cloud model. The same project always produces the same
        output — ideal for servers, queues, and CI.
      </Callout>

      <H2>What it will cover</H2>
      <ul className="my-4 space-y-2 text-fg-muted">
        {[
          "Project + source lifecycle",
          "The full operation catalog and types",
          "Streaming progress and structured errors",
          "Batch and queue patterns for production",
        ].map((t) => (
          <li key={t} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            {t}
          </li>
        ))}
      </ul>

      <NextCard href="/docs/operations" label="Editing operations" />
    </>
  );
}
