import type { Metadata } from "next";
import { DocHeader, H2, P, Code, NextCard } from "@/components/docs/doc-ui";

export const metadata: Metadata = {
  title: "Codex",
  description: "Use UltraCut with Codex — install the skills and edit video from the CLI.",
};

export default function Codex() {
  return (
    <>
      <DocHeader
        eyebrow="Agents"
        title="Codex"
        intro="UltraCut registers as tools Codex can call, turning plain-language edit requests into real editing operations."
      />
      <H2>Install</H2>
      <Code>{`$ npx skills add Vadagon/ultracut`}</Code>
      <H2>Make an edit</H2>
      <Code>{`❯ open media/demo.mp4, trim dead air, add captions,
  and render a 45s highlight`}</Code>
      <P>
        Codex plans a sequence of operations and executes them locally. See{" "}
        <a href="/docs/agents/prompting">Prompting</a> for phrasing that maps
        cleanly to edits.
      </P>
      <NextCard href="/docs/agents/gemini-cli" label="Gemini CLI" />
    </>
  );
}
