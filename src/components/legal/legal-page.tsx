import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 font-mono text-xs text-fg-subtle">Last updated: {updated}</p>
          <div className="legal-prose mt-10 space-y-6 text-sm leading-relaxed text-fg-muted">
            {children}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-fg">{heading}</h2>
      {children}
    </section>
  );
}
