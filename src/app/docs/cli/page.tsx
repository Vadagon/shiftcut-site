import type { Metadata } from "next";
import { DocHeader, H2, P, Code, Callout, NextCard } from "@/components/docs/doc-ui";

export const metadata: Metadata = {
  title: "CLI",
  description:
    "The UltraCut CLI — scaffold, preview, and render projects locally, and drop the same edits into scripts and CI.",
};

const commands = [
  ["ultracut init <dir>", "Scaffold a new project"],
  ["ultracut preview", "Live browser preview with hot reload"],
  ["ultracut render", "Render the current project"],
  ["ultracut check", "Validate a composition"],
  ["ultracut doctor", "Check the local environment"],
];

export default function Cli() {
  return (
    <>
      <DocHeader
        eyebrow="Surfaces"
        title="CLI"
        intro="The tools your agent uses, on the command line. Scaffold, preview, and render locally — perfect for scripts and CI."
      />

      <Callout tone="muted" title="Installing the skill?">
        To add UltraCut to your agent, use{" "}
        <code>npx skills add Vadagon/ultracut</code> — see{" "}
        <a href="/docs/installation">Installation</a>. The commands below are for
        working with a project directly.
      </Callout>

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

      <H2>Preview &amp; render</H2>
      <Code>{`$ ultracut preview          # watch it live in the browser
$ ultracut render --out out/  # render to a file`}</Code>

      <Callout title="Built for CI">
        Renders are reproducible, so the CLI drops straight into pipelines —
        cache the tools once and every run comes out the same.
      </Callout>

      <NextCard href="/docs/operations" label="Editing operations" />
    </>
  );
}
