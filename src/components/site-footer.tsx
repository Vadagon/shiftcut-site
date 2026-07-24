import Link from "next/link";
import { Mark } from "./logo";
import { site, legalNav } from "@/lib/site";
import { GitHubIcon } from "./icons";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "Pricing", href: "/pricing" },
      { label: "Browser Studio", href: "/docs/studio" },
      { label: "Roadmap", href: "/docs/roadmap" },
    ],
  },
  {
    title: "Agents",
    links: [
      { label: "Claude Code", href: "/docs/agents/claude-code" },
      { label: "Cursor", href: "/docs/agents/cursor" },
      { label: "Codex", href: "/docs/agents/codex" },
      { label: "Gemini CLI", href: "/docs/agents/gemini-cli" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "CLI", href: "/docs/cli" },
      { label: "API", href: "/docs/api" },
      { label: "Editing operations", href: "/docs/operations" },
      { label: "Project format", href: "/docs/project-format" },
    ],
  },
  {
    title: "Legal",
    links: [...legalNav],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <div className="flex items-center gap-2.5">
              <Mark className="h-6 w-6" />
              <span className="text-[15px] font-semibold tracking-tight">
                UltraCut
              </span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-fg-muted">
              Let your AI edit your videos. CapCut on autopilot.
            </p>
            <a
              href={site.github}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
            >
              <GitHubIcon className="h-4 w-4" />
              Star on GitHub
            </a>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-fg-muted transition-colors hover:text-fg"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-xs text-fg-subtle sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} UltraCut — a project by{" "}
            <a
              href={site.companyUrl}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-fg"
            >
              {site.company}
            </a>
            . Open source · Apache-2.0.
          </p>
          <div className="flex items-center gap-4">
            <span>
              Support:{" "}
              <a
                href={`mailto:${site.contact}`}
                className="transition-colors hover:text-fg"
              >
                {site.contact}
              </a>
            </span>
            <p className="font-mono">Payments secured by Creem</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
