# ShiftCut — marketing & docs site

The website for **ShiftCut**, the AI-native, agent-first programmable video editor.
_Open any video, tell your coding agent what you want, and ShiftCut does the editing._

Built with **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS v4**, and deployable to **Vercel**.

## Remote MCP

The editor exposes a project-scoped Streamable HTTP endpoint at `/api/mcp`.
Users copy the private capability URL shown in the editor and paste it into
their agent; possession of that URL grants access until it expires or is
revoked. Local development uses an in-memory relay. Vercel deployments require `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` so pairing sessions and tool calls survive across
serverless requests.

> This repo is the **website only**. The ShiftCut editing engine/framework is a
> separate, upcoming project. Copy here describes intended capabilities.

## Develop

```bash
npm run dev      # http://localhost:3000
npm run build    # production build (static)
npm start        # serve the production build
```

## Structure

```
src/
├── app/
│   ├── layout.tsx            # fonts, metadata, global chrome
│   ├── page.tsx              # homepage (all marketing sections)
│   ├── globals.css           # warm-dark design system (tokens, grain, glow)
│   └── docs/
│       ├── layout.tsx        # docs shell + sidebar
│       ├── page.tsx          # Introduction
│       └── …                 # getting started, agents, surfaces, reference
├── components/
│   ├── site-header.tsx       # sticky nav
│   ├── site-footer.tsx
│   ├── logo.tsx / icons.tsx
│   ├── home/terminal-demo.tsx  # animated hero terminal
│   └── docs/                 # sidebar + prose primitives
└── lib/site.ts               # single source of copy, nav, comparisons
```

Positioning, messaging, nav, and comparison data all live in `src/lib/site.ts`
so copy stays consistent across the homepage and docs.

## Design

Warm-dark, technical, minimal — Cursor / Linear / Vercel lineage. Amber accent
(`--accent`), charcoal surfaces, subtle film grain and accent glow. Tokens are
defined in `src/app/globals.css`.
