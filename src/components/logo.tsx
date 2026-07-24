import Link from "next/link";

export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* Two offset frames — the "shift", split by a "cut" */}
      <rect
        x="2.5"
        y="6.5"
        width="14"
        height="15"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="2"
        className="text-fg-subtle"
      />
      <rect
        x="10.5"
        y="2.5"
        width="15"
        height="15"
        rx="3.5"
        fill="var(--accent)"
      />
      <path
        d="M18 6.5 L14.5 13.5"
        stroke="var(--bg)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`group inline-flex items-center gap-2.5 ${className}`}
    >
      <Mark className="h-6 w-6 transition-transform group-hover:-translate-y-[1px]" />
      <span className="text-[15px] font-semibold tracking-tight text-fg">
        UltraCut
      </span>
    </Link>
  );
}
