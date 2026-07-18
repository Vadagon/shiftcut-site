import type { Metadata } from "next";
import { DocHeader, H2, P, Code, Callout, NextCard } from "@/components/docs/doc-ui";

export const metadata: Metadata = {
  title: "CLI",
  description:
    "The ShiftCut CLI — scriptable, composable commands for editing, batching, and rendering video in CI.",
};

const commands = [
  ["shiftcut init <dir>", "Scaffold a new project"],
  ["shiftcut add <agent>", "Register skills with an agent"],
  ["shiftcut edit <file>", "Run an edit from flags"],
  ["shiftcut render", "Render the current project"],
  ["shiftcut studio", "Open Browser Studio"],
  ["shiftcut doctor", "Check the local environment"],
];

export default function Cli() {
  return (
    <>
      <DocHeader
        eyebrow="Surfaces"
        title="CLI"
        intro="The engine with nothing between you and it. Scriptable, composable commands for CI, batch jobs, and power users."
      />

      <H2>Commands</H2>
      <div className="my-6 overflow-hidden rounded-xl border border-border">
        <table className="w-full border-collapse text-left text-sm">
          <tbody>
            {commands.map(([cmd, desc]) => (
              <tr key={cmd} className="border-b border-border last:border-0">
                <td className="w-56 px-4 py-3 font-mono text-[13px] text-accent">
                  {cmd}
                </td>
                <td className="px-4 py-3 text-fg-muted">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>Edit from flags</H2>
      <Code>{`$ shiftcut edit media/interview.mp4 \\
    --shorts 5 \\
    --captions hormozi \\
    --aspect 9:16 \\
    --remove-silences \\
    --out out/`}</Code>

      <Callout title="Built for CI">
        Deterministic renders mean the CLI drops straight into pipelines — cache
        the engine once and every run is reproducible.
      </Callout>

      <NextCard href="/docs/operations" label="Editing operations" />
    </>
  );
}
