import type { Metadata } from "next";
import { DocHeader, H2, P, Code, NextCard } from "@/components/docs/doc-ui";

export const metadata: Metadata = {
  title: "Gemini CLI",
  description: "Use ShiftCut with Gemini CLI — install the skills and edit video from your terminal.",
};

export default function GeminiCli() {
  return (
    <>
      <DocHeader
        eyebrow="Agents"
        title="Gemini CLI"
        intro="Wire ShiftCut into Gemini CLI to edit video straight from your terminal, driven by natural language."
      />
      <H2>Install</H2>
      <Code>{`$ npx skills add shiftcut/shiftcut`}</Code>
      <H2>Make an edit</H2>
      <Code>{`❯ turn media/stream.mp4 into three shorts
  with bold captions`}</Code>
      <P>
        Everything runs locally, so results are the same whether you use Gemini
        CLI, Claude Code, or the raw <a href="/docs/cli">CLI</a>.
      </P>
      <NextCard href="/docs/agents/prompting" label="Prompting patterns" />
    </>
  );
}
