import Link from "next/link";
import { ArrowIcon } from "@/components/icons";

export function DocHeader({
  eyebrow,
  title,
  intro,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
}) {
  return (
    <header className="mb-10 border-b border-border pb-8">
      {eyebrow && (
        <span className="font-mono text-xs uppercase tracking-wider text-accent">
          {eyebrow}
        </span>
      )}
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fg">
        {title}
      </h1>
      {intro && (
        <p className="mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-fg-muted">
          {intro}
        </p>
      )}
    </header>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-12 mb-4 text-xl font-semibold tracking-tight text-fg">
      {children}
    </h2>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="my-4 leading-relaxed text-fg-muted [&_a]:text-accent [&_a:hover]:underline [&_code]:rounded [&_code]:bg-surface [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-fg [&_strong]:text-fg [&_strong]:font-medium">
      {children}
    </p>
  );
}

export function Code({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-5 overflow-x-auto rounded-xl border border-border bg-[#0c0c0e]">
      <pre className="px-4 py-3.5 font-mono text-[13px] leading-relaxed text-fg-muted">
        {children}
      </pre>
    </div>
  );
}

export function Callout({
  title,
  children,
  tone = "accent",
}: {
  title?: string;
  children: React.ReactNode;
  tone?: "accent" | "muted";
}) {
  return (
    <div
      className={`my-6 rounded-xl border p-4 text-sm leading-relaxed ${
        tone === "accent"
          ? "border-accent/25 bg-accent-soft text-fg-muted"
          : "border-border bg-surface/40 text-fg-muted"
      }`}
    >
      {title && (
        <p className="mb-1 font-medium text-fg">{title}</p>
      )}
      {children}
    </div>
  );
}

export function Steps({ children }: { children: React.ReactNode }) {
  return (
    <ol className="my-6 space-y-6 border-l border-border pl-6 [counter-reset:step]">
      {children}
    </ol>
  );
}

export function Step({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="relative [counter-increment:step]">
      <span className="absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface font-mono text-xs text-accent before:content-[counter(step)]" />
      <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed text-fg-muted">
        {children}
      </div>
    </li>
  );
}

export function NextCard({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group mt-14 flex items-center justify-between rounded-xl border border-border bg-surface/40 px-5 py-4 transition-colors hover:border-border-strong hover:bg-surface"
    >
      <div>
        <span className="text-xs text-fg-subtle">Next</span>
        <p className="text-[15px] font-medium text-fg">{label}</p>
      </div>
      <ArrowIcon className="h-4 w-4 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
    </Link>
  );
}

export function ComingSoon() {
  return (
    <Callout tone="muted" title="This page is on the way">
      UltraCut is under active development and this section of the docs is still
      being written. The structure below reflects what it will cover.
    </Callout>
  );
}
