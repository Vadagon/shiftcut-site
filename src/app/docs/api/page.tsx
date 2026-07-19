import type { Metadata } from "next";
import { DocHeader, H2, P, Code, Callout, ComingSoon, NextCard } from "@/components/docs/doc-ui";

export const metadata: Metadata = {
  title: "API",
  description:
    "A planned library to embed ShiftCut's local editing power into your own product, server, or pipeline.",
};

export default function Api() {
  return (
    <>
      <DocHeader
        eyebrow="Surfaces"
        title="API"
        intro="The same editing power behind your agent, as a library you can drop into your own product or pipeline."
      />

      <ComingSoon />

      <P>
        An embeddable library is on the roadmap. Today, drive ShiftCut through
        your <a href="/docs/agents/claude-code">agent</a> or the{" "}
        <a href="/docs/cli">CLI</a>. The shape it&apos;s heading toward:
      </P>

      <H2>Programmatic edits</H2>
      <P>
        Build and render projects in code — anything an agent can do, your app
        will be able to do:
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
        Runs on your own infrastructure — no footage leaves your machine. The
        same project always produces the same output, ideal for servers, queues,
        and CI.
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
