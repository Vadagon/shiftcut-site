// An explained empty media box. Renders where a real screenshot/video will go,
// and tells whoever delivers the asset exactly what belongs there.
export function MediaPlaceholder({
  label,
  note,
  aspect = "16 / 9",
}: {
  label: string;
  note: string;
  aspect?: string;
}) {
  return (
    <div
      className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border-strong bg-surface/30 p-6 text-center"
      style={{ aspectRatio: aspect }}
    >
      {/* subtle grid so an empty box still looks intentional */}
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-bg/60 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-fg-subtle">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Media placeholder
        </span>
        <p className="mt-4 text-[15px] font-semibold text-fg">{label}</p>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-fg-muted">{note}</p>
        <p className="mt-4 font-mono text-[11px] text-fg-subtle">to be delivered</p>
      </div>
    </div>
  );
}
