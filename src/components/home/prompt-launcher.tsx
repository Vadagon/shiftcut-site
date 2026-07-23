"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowIcon } from "@/components/icons";

const EXAMPLES = [
  "Cut this podcast into 5 shorts",
  "Add captions and make it vertical",
  "Remove the silences and filler words",
  "Generate a 30-second highlight trailer",
];

// "Type an edit" → opens the editor with the prompt prefilled.
export function PromptLauncher() {
  const router = useRouter();
  const [value, setValue] = useState("");

  const go = (text: string) => {
    const q = text.trim();
    router.push(q ? `/editor?prompt=${encodeURIComponent(q)}` : "/editor");
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    go(value);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2 rounded-2xl border border-border bg-[#0c0c0e] p-2 focus-within:border-border-strong"
      >
        <span className="pl-3 font-mono text-accent">❯</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Describe an edit…"
          aria-label="Describe an edit"
          className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-fg placeholder:text-fg-subtle focus:outline-none"
        />
        <button
          type="submit"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-bg transition-colors hover:bg-accent-hover"
        >
          Open editor
          <ArrowIcon className="h-4 w-4" />
        </button>
      </form>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => go(ex)}
            className="rounded-full border border-border px-3 py-1 text-xs text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
