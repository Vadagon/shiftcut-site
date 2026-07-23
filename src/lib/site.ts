// Central content + navigation config for the ShiftCut marketing site.
// One promise, everywhere: open a video, tell your AI what you want, get it
// back edited. Sell the magic — no competitor benchmarks, no engine jargon.

export const site = {
  name: "ShiftCut",
  tagline: "CapCut on autopilot",
  domain: "shiftcut.verblike.com",
  github: "https://github.com/Vadagon/shiftcut",
  company: "Vladyslav Verbytskyi",
  companyUrl: "https://verblike.com",
  contact: "shiftcut@verblike.com",
  description:
    "The video editor your AI drives. Open any video, tell Claude Code, Cursor, or Codex what you want, and it does the editing — right on your machine.",
} as const;

export const primaryNav = [
  { label: "Docs", href: "/docs" },
  { label: "Agents", href: "/docs/agents/claude-code" },
  { label: "Studio", href: "/docs/studio" },
  { label: "Pricing", href: "/pricing" },
] as const;

// ── Pricing / plans ───────────────────────────────────────────
// The editor, local render, and MCP (bring your own agent) are free forever.
// The only paid feature is the in-editor AI copilot. Billing via Creem.
export const plans = [
  {
    id: "free",
    name: "Bring your own agent",
    price: "$0",
    cadence: "forever",
    tagline: "Use Codex, Claude, or Gemini — you drive.",
    cta: "Start free",
    ctaHref: "/editor",
    highlight: false,
    // Not a Creem plan — no checkout.
    creemPlan: null as null | "monthly" | "yearly",
    features: [
      "Full browser editor, timeline & components",
      "100% local — projects never leave your device",
      "Client-side MP4 export, unlimited",
      "MCP access: connect Codex, Claude Code, or Gemini",
      "Open source, Apache-2.0",
    ],
  },
  {
    id: "pro-monthly",
    name: "AI Copilot",
    price: "$10",
    cadence: "per month",
    tagline: "In-editor natural-language editing. Cancel anytime.",
    cta: "Get monthly",
    ctaHref: null,
    highlight: false,
    creemPlan: "monthly" as const,
    badge: "Cancel anytime",
    features: [
      "Everything in Bring your own agent",
      "Built-in AI copilot — just type what you want",
      "No agent or API key of your own required",
      "Fair-use token allotment each month",
      "Cancel anytime from the billing portal",
    ],
  },
  {
    id: "pro-yearly",
    name: "AI Copilot — Yearly",
    price: "$60",
    cadence: "per year",
    tagline: "Same copilot, ~50% cheaper. Start with 3 days free.",
    cta: "Start 3-day free trial",
    ctaHref: null,
    highlight: true,
    creemPlan: "yearly" as const,
    badge: "3 days free · save 50%",
    features: [
      "Everything in AI Copilot monthly",
      "3-day free trial — cancel before it ends, pay nothing",
      "Six months free vs. paying monthly",
      "One yearly payment, cancel anytime",
    ],
  },
] as const;

// Footer / compliance links required for the Creem account review.
export const legalNav = [
  { label: "Terms of Service", href: "/legal/terms" },
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Refund & Cancellation", href: "/legal/refund" },
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

// Install — one command adds the skill; the "then" step differs per tool.
// Claude Code is the default and primary target.
export const installCommand = "npx skills add Vadagon/shiftcut";

export const installTargets = [
  {
    id: "claude-code",
    name: "Claude Code",
    note: "Restart Claude Code, then start a message with /shiftcut.",
  },
  {
    id: "cursor",
    name: "Cursor",
    note: "Reload Cursor, then reference a video and describe the edit.",
  },
  {
    id: "codex",
    name: "Codex",
    note: "Restart Codex — the skill is available as tools it can call.",
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    note: "Restart Gemini CLI and edit video straight from your terminal.",
  },
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
    name: "Command line",
    feels: "for power users",
    body: "Preview, render, and batch from the terminal — perfect for scripts and repeatable jobs.",
    href: "/docs/cli",
  },
  {
    name: "Browser Studio",
    feels: "coming soon",
    body: "A CapCut-style visual timeline for nudging things by hand — driving the exact same project as your agent.",
    href: "/docs/studio",
  },
  {
    name: "API",
    feels: "coming soon",
    body: "Drop the same local editing power into your own product, server, or pipeline.",
    href: "/docs/api",
  },
] as const;

// Concrete capabilities — what the agent actually does to your footage.
// Each is a real thing you ask for in plain words (mirrors how creators think).
export const capabilities = [
  {
    title: "Finds the best moments",
    body: "It watches the footage, spots the highlights, and cuts the rambling, dead air, and repeated takes.",
    tag: "Highlights",
  },
  {
    title: "Captions in 100+ languages",
    body: "Accurate, styled captions synced to every word — Hormozi-style pop, clean, or your own look.",
    tag: "Captions",
  },
  {
    title: "Reframes for every platform",
    body: "One horizontal cut becomes a vertical 9:16 for TikTok, Shorts, and Reels — subject kept in frame.",
    tag: "Reframe",
  },
  {
    title: "Removes silences & filler",
    body: "“Cut the ums and the long pauses.” Tighten a talking-head clip without scrubbing the timeline.",
    tag: "Clean up",
  },
  {
    title: "Turns one video into many",
    body: "“Make five shorts from this podcast.” Batch a whole channel from a single sentence.",
    tag: "Repurpose",
  },
  {
    title: "Builds intros & motion graphics",
    body: "Chapter cards, titles, and animated overlays generated from a description — no keyframing.",
    tag: "Motion",
  },
] as const;

// The wedge vs. cloud editors like ChatCut — what they can't say.
export const comparison = [
  {
    title: "Free, not credit-metered",
    body: "Bring your own agent and pay $0. No monthly credits to ration, no per-generation meter running.",
  },
  {
    title: "Runs on your machine",
    body: "Your footage never uploads to someone's cloud. Edit offline, keep raw files and clients private.",
  },
  {
    title: "Open source",
    body: "Apache-2.0 and yours to keep — inspect it, fork it, self-host it. No lock-in, no black box.",
  },
  {
    title: "Works in the agent you already use",
    body: "Claude Code, Codex, Cursor, Gemini — or the CLI. Not one more login and subscription.",
  },
] as const;

// Home-page FAQ — mirrors the questions a creator comparing tools asks.
export const homeFaqs = [
  {
    q: "What is ShiftCut?",
    a: "An AI-native video editor you drive by talking to your coding agent. Open a video, describe the edit in plain words, and it does the work — locally, on your machine.",
  },
  {
    q: "Is it really free?",
    a: "Yes. The editor, local MP4 export, and MCP access are free forever. If you bring your own agent (Codex, Claude Code, Gemini) you pay nothing. The optional built-in AI copilot is $10/mo, or $60/yr with a 3-day free trial.",
  },
  {
    q: "Does my footage get uploaded?",
    a: "No. ShiftCut runs 100% locally — your files stay on your device. That's the core difference from cloud editors.",
  },
  {
    q: "Which agents does it work with?",
    a: "Claude Code, Codex, Cursor, and Gemini CLI via one skill, plus a command line for scripts and batch jobs. A visual Browser Studio is on the way.",
  },
  {
    q: "Do I need to know video editing?",
    a: "No timelines, no keyframes. If you can describe what you want — “add captions,” “make it vertical,” “cut the boring parts” — ShiftCut handles the rest.",
  },
  {
    q: "Can I still edit by hand?",
    a: "Yes. The upcoming Browser Studio gives you a CapCut-style visual timeline driving the exact same project your agent edits.",
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
