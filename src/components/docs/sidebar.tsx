"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { docsNav } from "@/lib/site";

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-7">
      {docsNav.map((group) => (
        <div key={group.title}>
          <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-fg-subtle">
            {group.title}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block rounded-lg px-2 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-accent-soft font-medium text-accent"
                        : "text-fg-muted hover:bg-surface hover:text-fg"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
