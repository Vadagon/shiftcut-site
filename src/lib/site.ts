// Central content + navigation config for the ShiftCut marketing site.
// One promise, everywhere: open a video, tell your AI what you want, get it
// back edited. Sell the magic — no competitor benchmarks, no engine jargon.

export const site = {
  name: "ShiftCut",
  tagline: "CapCut on autopilot",
  domain: "shiftcut.dev",
  github: "https://github.com/shiftcut/shiftcut",
  description:
    "The video editor your AI drives. Open any video, tell Claude Code, Cursor, or Codex what you want, and it does the editing — right on your machine.",
} as const;

export const primaryNav = [
  { label: "Docs", href: "/docs" },
  { label: "Agents", href: "/docs/agents/claude-code" },
  { label: "Studio", href: "/docs/studio" },
  { label: "API", href: "/docs/api" },
] as const;

// Agents / surfaces the visitor already uses.
export const agents = [
  { name: "Claude Code", kind: "agent", glyph: "◇" },
  { name: "Cursor", kind: "agent", glyph: "▹" },
  { name: "Codex", kind: "agent", glyph: "⌘" },
  { name: "Gemini CLI", kind: "agent", glyph: "✦" },
  { name: "CLI", kind: "surface", glyph: "$" },
  { name: "Browser Studio", kind: "surface", glyph: "▤" },
  { name: "API", kind: "surface", glyph: "{}" },
] as const;

// The magic — real things you say out loud to your agent.
export const examplePrompts = [
  { text: "Turn this podcast into five Shorts.", tag: "Repurpose" },
  { text: "Remove the awkward pauses and filler words.", tag: "Clean up" },
  { text: "Add Hormozi-style captions, synced.", tag: "Captions" },
  { text: "Export a vertical 9:16 cut for TikTok.", tag: "Reframe" },
  { text: "Generate a 30-second trailer from the best moments.", tag: "Highlight" },
  { text: "Replace the background behind the speaker.", tag: "Compose" },
  { text: "Make the intro more engaging and punchy.", tag: "Retime" },
  { text: "Animate these screenshots into a product demo.", tag: "Motion" },
] as const;

// How it works — three plain steps, no learning curve.
export const steps = [
  {
    title: "Open any video",
    body: "Point ShiftCut at a clip you already have — an interview, a screen recording, a livestream, a rough cut.",
  },
  {
    title: "Tell your AI what you want",
    body: "“Cut this into five shorts.” “Add captions.” “Make it vertical.” Plain words — no timeline, no keyframes.",
  },
  {
    title: "Get it back, edited",
    body: "ShiftCut does the work on your machine and hands you finished files, ready to post.",
  },
] as const;

// Why you'll love it — benefits, not internals.
export const benefits = [
  {
    title: "Just talk to it",
    body: "No timelines, no keyframes, no learning curve. Describe the result and your agent handles the rest.",
  },
  {
    title: "Runs on your machine",
    body: "Your footage never leaves your computer. Edit offline, keep everything private.",
  },
  {
    title: "Free and open source",
    body: "Apache-2.0 and yours to keep. No subscriptions, no watermarks, no export limits.",
  },
  {
    title: "Works where you already work",
    body: "Claude Code, Cursor, Codex, Gemini CLI — or a visual studio right in your browser.",
  },
  {
    title: "Fast, and repeatable",
    body: "Batch a whole channel from a single prompt. What works once works the same way every time.",
  },
  {
    title: "Edits first, creates too",
    body: "Best at making real footage better. When you need it, it builds intros and motion graphics from scratch too.",
  },
] as const;

// Surfaces — the same tool, however you like to work.
export const surfaces = [
  {
    name: "Claude Code",
    feels: "just talk to it",
    body: "Point Claude Code at a file and describe the edit in plain language. It does the rest.",
    href: "/docs/agents/claude-code",
  },
  {
    name: "Browser Studio",
    feels: "feels like CapCut",
    body: "A visual timeline for when you want to nudge something by hand. Every change is the same edit your agent would make.",
    href: "/docs/studio",
  },
  {
    name: "Command line",
    feels: "for power users",
    body: "One command to edit, batch, and export — perfect for scripts and repeatable jobs.",
    href: "/docs/cli",
  },
  {
    name: "API",
    feels: "for your app",
    body: "Drop the same editing power into your own product, server, or pipeline.",
    href: "/docs/api",
  },
] as const;

// Docs sidebar structure.
export const docsNav = [
  {
    title: "Getting started",
    items: [
      { label: "Introduction", href: "/docs" },
      { label: "Quickstart", href: "/docs/quickstart" },
      { label: "Installation", href: "/docs/installation" },
      { label: "Core concepts", href: "/docs/concepts" },
    ],
  },
  {
    title: "Agents",
    items: [
      { label: "Claude Code", href: "/docs/agents/claude-code" },
      { label: "Cursor", href: "/docs/agents/cursor" },
      { label: "Codex", href: "/docs/agents/codex" },
      { label: "Gemini CLI", href: "/docs/agents/gemini-cli" },
      { label: "Prompting", href: "/docs/agents/prompting" },
    ],
  },
  {
    title: "Surfaces",
    items: [
      { label: "CLI", href: "/docs/cli" },
      { label: "Browser Studio", href: "/docs/studio" },
      { label: "API", href: "/docs/api" },
    ],
  },
  {
    title: "Reference",
    items: [
      { label: "Editing operations", href: "/docs/operations" },
      { label: "Project format", href: "/docs/project-format" },
      { label: "Roadmap", href: "/docs/roadmap" },
    ],
  },
] as const;
