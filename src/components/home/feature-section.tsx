import { MediaPlaceholder } from "./media-placeholder";
import { featureSections } from "@/lib/site";

type Feature = (typeof featureSections)[number];

// One full-width "hero moment" per feature, media alternating left/right.
export function FeatureSection({ feature, index }: { feature: Feature; index: number }) {
  const reversed = index % 2 === 1;
  return (
    <section className="border-t border-border">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div className={reversed ? "lg:order-2" : ""}>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/50 px-3 py-1 font-mono text-xs text-fg-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {feature.eyebrow}
          </span>
          <h2 className="mt-5 text-balance text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">
            {feature.title}
          </h2>
          <p className="mt-4 max-w-lg text-pretty text-[15px] leading-relaxed text-fg-muted">
            {feature.body}
          </p>
          <div className="mt-6 inline-flex max-w-full items-center gap-3 rounded-xl border border-border bg-[#0c0c0e] px-4 py-3">
            <span className="font-mono text-accent">❯</span>
            <span className="truncate text-[14px] text-fg">{feature.prompt}</span>
          </div>
        </div>
        <div className={reversed ? "lg:order-1" : ""}>
          <MediaPlaceholder
            label={feature.media.label}
            note={feature.media.note}
            aspect={feature.media.aspect}
          />
        </div>
      </div>
    </section>
  );
}
