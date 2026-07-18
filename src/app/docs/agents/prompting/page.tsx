import type { Metadata } from "next";
import { DocHeader, H2, P, Code, Callout, NextCard } from "@/components/docs/doc-ui";

export const metadata: Metadata = {
  title: "Prompting",
  description:
    "How to prompt your agent for great edits with ShiftCut — the vocabulary of cuts, captions, reframing, and pacing.",
};

const vocab = [
  { term: "Pacing", maps: "snappy · punchy · calm · let it breathe" },
  { term: "Captions", maps: "hormozi · clean · minimal · subtitle" },
  { term: "Reframe", maps: "vertical 9:16 · square 1:1 · widescreen 16:9" },
  { term: "Cleanup", maps: "remove filler · cut silences · tighten" },
  { term: "Highlight", maps: "trailer · best moments · 60s recap" },
];

export default function Prompting() {
  return (
    <>
      <DocHeader
        eyebrow="Agents"
        title="Prompting"
        intro="ShiftCut edits from intent. The clearer the outcome you describe, the better the first result — and you refine from there."
      />

      <H2>Name the source, outcome, and style</H2>
      <P>
        A good prompt says <strong>what to edit</strong>,{" "}
        <strong>what you want out</strong>, and <strong>how it should feel</strong>.
      </P>
      <Code>{`❯ turn interview.mp4 into five 30s shorts,
  hormozi captions, vertical, punchy pacing`}</Code>

      <H2>Vocabulary that maps to operations</H2>
      <div className="my-6 overflow-hidden rounded-xl border border-border">
        <table className="w-full border-collapse text-left text-sm">
          <tbody>
            {vocab.map((v) => (
              <tr key={v.term} className="border-b border-border last:border-0">
                <td className="w-32 px-4 py-3 font-medium text-fg">{v.term}</td>
                <td className="px-4 py-3 font-mono text-[13px] text-fg-muted">
                  {v.maps}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Callout title="Iterate, don't restart">
        After the first render, refine conversationally: &quot;tighten the
        open,&quot; &quot;bigger captions,&quot; &quot;export a square version
        too.&quot; ShiftCut edits the existing project instead of starting over.
      </Callout>

      <H2>Warm starts</H2>
      <P>
        Give the agent context — a transcript, a brand guide, a reference clip —
        and it&apos;ll match style and structure. &quot;Edit like this reference,
        but for demo.mp4&quot; works well.
      </P>

      <NextCard href="/docs/cli" label="CLI reference" />
    </>
  );
}
