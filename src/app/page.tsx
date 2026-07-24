import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { InstallPicker } from "@/components/home/install-picker";
import { PromptLauncher } from "@/components/home/prompt-launcher";
import { FeatureSection } from "@/components/home/feature-section";
import { MediaPlaceholder } from "@/components/home/media-placeholder";
import { ArrowIcon, CheckIcon, GitHubIcon } from "@/components/icons";
import {
  agents,
  captionStyles,
  comparison,
  examplePrompts,
  featureSections,
  homeFaqs,
  plans,
  site,
  socialProof,
  steps,
} from "@/lib/site";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/50 px-3 py-1 font-mono text-xs text-fg-muted">
      {children}
    </span>
  );
}

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div className="grid-bg pointer-events-none absolute inset-0 mask-fade-b opacity-70" />
          <div
            className="pointer-events-none absolute left-1/2 top-[-10%] h-[420px] w-[820px] -translate-x-1/2 rounded-full opacity-40 blur-[120px]"
            style={{
              background:
                "radial-gradient(closest-side, rgba(255,122,26,0.5), transparent)",
            }}
          />
          <div className="relative mx-auto max-w-5xl px-5 pb-16 pt-16 text-center sm:px-8 lg:pt-24">
            <div className="flex justify-center">
              <Eyebrow>
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Free &amp; open source · {site.tagline}
              </Eyebrow>
            </div>

            <h1 className="mt-6 text-balance text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              <span className="text-gradient">Your coding agent</span>
              <br />
              <span className="text-gradient-accent">can now edit video.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-fg-muted">
              Open any video, tell Claude Code, Cursor, or Codex what you want —
              and it does the editing for you. No timeline. No learning curve.
              Just say it out loud.
            </p>

            {/* Interactive "type an edit" launcher */}
            <div className="mt-8">
              <PromptLauncher />
            </div>

            {/* Agent-first entry points */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/docs/agents/claude-code"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-fg transition-colors hover:border-border-strong"
              >
                Use in Claude Code
              </Link>
              <Link
                href="/docs/agents/codex"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-fg transition-colors hover:border-border-strong"
              >
                Use in Codex
              </Link>
              <a
                href={site.github}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-fg transition-colors hover:border-border-strong"
              >
                <GitHubIcon className="h-4 w-4" />
                GitHub
              </a>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-xs text-fg-subtle">
              {["Apache-2.0 open source", "Free forever", "100% local"].map((b) => (
                <span key={b} className="inline-flex items-center gap-2">
                  <span className="text-accent">✓</span>
                  {b}
                </span>
              ))}
            </div>

            {/* Hero demo — the money shot */}
            <div className="animate-rise mt-14">
              <MediaPlaceholder
                label="Demo project — one prompt, five ready-to-post shorts"
                note="Hero demo video or screen recording: a real edit happening in UltraCut — a prompt going in, the timeline building itself, and finished clips coming out. This is the single most important asset on the page."
                aspect="16 / 9"
              />
            </div>
          </div>
        </section>

        {/* ── Social proof ─────────────────────────────────────── */}
        <section className="border-y border-border bg-bg-elevated/40">
          <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
            <p className="text-center text-xs uppercase tracking-wider text-fg-subtle">
              Trusted by creators who ship
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-dashed border-border-strong bg-surface/30 px-4 py-5 text-center">
                <p className="text-[13px] font-semibold text-fg">Metrics strip</p>
                <p className="mt-1 text-[12px] text-fg-muted">{socialProof.metricNote}</p>
                <p className="mt-2 font-mono text-[11px] text-fg-subtle">to be delivered</p>
              </div>
              <div className="rounded-xl border border-dashed border-border-strong bg-surface/30 px-4 py-5 text-center">
                <p className="text-[13px] font-semibold text-fg">Logos / Product Hunt</p>
                <p className="mt-1 text-[12px] text-fg-muted">{socialProof.logosNote}</p>
                <p className="mt-2 font-mono text-[11px] text-fg-subtle">to be delivered</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Agent strip ──────────────────────────────────────── */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
            <p className="text-center text-xs uppercase tracking-wider text-fg-subtle">
              Works with the coding agent you already use
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {agents.map((a) => (
                <span
                  key={a.name}
                  className="inline-flex items-center gap-2 text-sm text-fg-muted"
                >
                  <span
                    className={`font-mono ${
                      a.kind === "agent" ? "text-accent" : "text-fg-subtle"
                    }`}
                  >
                    {a.glyph}
                  </span>
                  {a.name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── The magic: what you can say ─────────────────────── */}
        <SectionShell
          eyebrow="The magic"
          title="Just say what you want."
          lead="No scrubbing a timeline. No nudging keyframes. Talk to your AI the way you'd talk to an editor — and it happens."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {examplePrompts.map((p) => (
              <div
                key={p.text}
                className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-surface/40 px-4 py-3.5 transition-colors hover:border-border-strong hover:bg-surface"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-accent">❯</span>
                  <span className="text-[15px] text-fg">{p.text}</span>
                </div>
                <span className="hidden shrink-0 rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-fg-subtle sm:inline">
                  {p.tag}
                </span>
              </div>
            ))}
          </div>
        </SectionShell>

        {/* ── Feature moments (one per capability) ─────────────── */}
        {featureSections.map((feature, i) => (
          <div key={feature.id}>
            <FeatureSection feature={feature} index={i} />
            {feature.id === "captions" && (
              <div className="mx-auto -mt-8 max-w-6xl px-5 pb-4 sm:px-8">
                <div className="flex flex-wrap gap-2">
                  {captionStyles.map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-border bg-surface/40 px-3 py-1 font-mono text-xs text-fg-muted"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* ── Install ─────────────────────────────────────────── */}
        <SectionShell
          eyebrow="Get it in seconds"
          title="Pick your tool. Copy one line."
          lead="UltraCut installs as a skill for the coding agent you already have. One command and you're editing."
        >
          <InstallPicker />
        </SectionShell>

        {/* ── How it works ────────────────────────────────────── */}
        <SectionShell
          eyebrow="How it works"
          title="Three steps. That's the whole thing."
        >
          <ol className="grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <li
                key={s.title}
                className="relative rounded-xl border border-border bg-surface/40 p-6"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft font-mono text-sm text-accent">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-[15px] font-semibold text-fg">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </SectionShell>

        {/* ── The wedge: why not a cloud editor ───────────────── */}
        <SectionShell
          eyebrow="Why UltraCut"
          title="Everything a cloud editor does — without the cloud, the credits, or the lock-in."
          lead="Other AI editors upload your footage and charge by the generation. UltraCut runs on your machine and stays free with your own agent."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {comparison.map((c) => (
              <div
                key={c.title}
                className="flex items-start gap-3 rounded-xl border border-border bg-surface/40 p-5"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                  <CheckIcon className="h-3 w-3" />
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold text-fg">{c.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionShell>

        {/* ── Pricing teaser ──────────────────────────────────── */}
        <SectionShell
          eyebrow="Pricing"
          title="From $5/month — to replace a $1k+ expert editor."
          lead="The editor, local export, and MCP access are free forever. Only the in-editor AI copilot is paid."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`flex flex-col rounded-xl border p-5 ${
                  plan.highlight ? "border-accent bg-accent-soft/20" : "border-border bg-surface/40"
                }`}
              >
                <h3 className="text-sm font-semibold text-fg">{plan.name}</h3>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold tracking-tight">{plan.price}</span>
                  <span className="text-xs text-fg-subtle">{plan.cadence}</span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">{plan.tagline}</p>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-fg transition-colors hover:border-border-strong"
            >
              See full pricing
              <ArrowIcon className="h-4 w-4" />
            </Link>
          </div>
        </SectionShell>

        {/* ── FAQ ─────────────────────────────────────────────── */}
        <SectionShell eyebrow="FAQ" title="Questions, answered.">
          <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {homeFaqs.map((item) => (
              <div key={item.q}>
                <dt className="text-[15px] font-semibold text-fg">{item.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-fg-muted">{item.a}</dd>
              </div>
            ))}
          </dl>
        </SectionShell>

        {/* ── Final CTA ───────────────────────────────────────── */}
        <section className="relative overflow-hidden border-t border-border">
          <div
            className="pointer-events-none absolute inset-x-0 bottom-[-40%] mx-auto h-[420px] w-[820px] rounded-full opacity-30 blur-[120px]"
            style={{
              background:
                "radial-gradient(closest-side, rgba(255,122,26,0.45), transparent)",
            }}
          />
          <div className="relative mx-auto max-w-3xl px-5 py-24 text-center sm:px-8">
            <h2 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              <span className="text-gradient">Point your AI at a video.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-lg text-fg-muted">
              Tell it what you want. Get it back edited. That&apos;s UltraCut.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/editor"
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg transition-colors hover:bg-accent-hover"
              >
                Open the editor
                <ArrowIcon className="h-4 w-4" />
              </Link>
              <a
                href={site.github}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-3 text-sm font-medium text-fg transition-colors hover:border-border-strong"
              >
                <GitHubIcon className="h-4 w-4" />
                Star on GitHub
              </a>
            </div>
            <p className="mt-6 font-mono text-xs text-fg-subtle">
              Free forever · Apache-2.0 · runs on your machine
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

/* ── Local section primitive ────────────────────────────────── */

function SectionShell({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="mt-5 max-w-3xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h2>
        {lead && (
          <p className="mt-4 max-w-2xl text-pretty leading-relaxed text-fg-muted">
            {lead}
          </p>
        )}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}
