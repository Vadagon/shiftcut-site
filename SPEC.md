# ShiftCut — product & architecture spec

> Source of truth for the framework recode. Locked 2026-07-19.
> When a detail isn't specified here: **do exactly what HyperFrames does.**

## 1. What ShiftCut is

An **AI-native, agent-first video editor** — "CapCut on autopilot." Open any video,
tell your coding agent what you want, and ShiftCut does the editing. Editing existing
footage is the primary job; creating video from scratch is secondary.

- **Independent** fork of HyperFrames (hyperframes.heygen.com). Not affiliated with HeyGen.
- Name **ShiftCut** is final. Domain `shiftcut.dev`. Org/repo `shiftcut/shiftcut`.
- **Free forever. 100% local. Open source (Apache-2.0).**

## 2. Architecture — match HyperFrames technically

The engine **is** HyperFrames, rebranded, plus an editing layer. Do not invent a new model.

- **Composition format = HTML** (NOT JSON). `data-composition-id`, `data-width`,
  `data-height`; timed elements use `class="clip"` + `data-start` / `data-duration` /
  `data-track-index`; GSAP timeline created `{ paused: true }`, registered on
  `window.__timelines`. Sub-compositions, tracks, variables — as HyperFrames.
- **Single paused, seek-safe timeline. Deterministic render** via headless **Chromium + FFmpeg**.
- **Project on disk** mirrors HyperFrames: `meta.json`, `index.html`, `compositions/`, `assets/`.
- Editing is **non-destructive**: source media is untouched; edits live in the composition,
  which is plain, diffable, and version-controllable.

### What we ADD on top of HyperFrames (the "editor" part)
A local **understanding + editing** layer so the agent operates on real footage:
- **Whisper.cpp** — transcription (words, timestamps, speakers).
- **OpenCV** — scene detection, faces (for reframing), motion.
- **Silence / filler detection** — for cleanup and tightening.
- Source video clips referenced in the composition with in/out points, driven by the above.

### What we REMOVE from HyperFrames
- **Every cloud-dependent feature.** Cloud/Lambda/Cloud Run rendering, hosted services,
  any op that requires a remote model. Everything runs on the user's machine.

## 3. Determinism

- **Render is deterministic:** same composition → same output bytes, on any machine.
- The **AI planning/understanding step is separate and best-effort** — never claim its
  output is byte-identical. Marketing says "the same project renders the same, every time,"
  not "the AI always produces the same edit."

## 4. Operations

Operations are **edits the agent makes to the HTML composition** (no separate op-log).

- **MVP:** `shorts` · `captions` · `remove-silences` (incl. filler words) · `reframe` (16:9→9:16, face-aware).
- **Near-term:** cut/trim/reorder/split/join/retime · transcribe/detect-scenes/detect-silences/find-highlights ·
  titles/transitions · replace-background (local) · replace-audio · color · trailer/highlight · export.
- **Dropped (cloud-ish, revisit later):** translate, upscale, restyle.
- **Generation from scratch** = reuse HyperFrames compositions (motion graphics, GSAP, slides).

## 5. Agents & skills

- Install via HyperFrames' mechanism: **`npx skills add shiftcut/shiftcut`**.
- **`/shiftcut`** router skill loads context + routes requests (mirrors `/hyperframes`).
- Skill set = HyperFrames' skills, **forked and rebranded** (e.g. `shiftcut-core`,
  `shiftcut-animation`, `shiftcut-creative`, `shiftcut-cli`, `media-use`, `shiftcut-registry`),
  plus an **understanding/editing** skill for the new capabilities.
- **Claude Code is primary.** Cursor / Codex / Gemini CLI use the same skill; only the
  "restart / reload" step differs per agent.

## 6. Surfaces

- **CLI** (now): HyperFrames verbs — `init · preview · render · doctor · check`.
- **Preview + playground** (now): live browser preview, as HyperFrames.
- **Browser Studio** (CapCut-style visual timeline): **roadmap.** Not shipped at launch.
- **API** (embeddable library): **roadmap.** Not a launch deliverable.
- **Cloud rendering:** out of scope (local-only, free forever).

## 7. Platform

- **Node 22+**, npm/bun. **FFmpeg** required on PATH. **Chromium** fetched on first use.
- macOS, Linux, Windows.

## 8. Recode plan (next phase)

1. Clone HyperFrames → rename everything to ShiftCut (`hyperframes*` → `shiftcut*`, `/hyperframes` → `/shiftcut`).
2. Strip all cloud/hosted features and their docs.
3. Add the local understanding+editing layer (Whisper.cpp, OpenCV, silence detection) and the MVP ops.
4. Fork + rebrand the skills; wire `/shiftcut` and `npx skills add shiftcut/shiftcut`.
5. Rewrite the editing-facing docs; keep the composition/animation docs close to HyperFrames.

## 9. Open follow-ups (not blocking)

- Favicon + OG image (site still on Next defaults).
- Examples/showcase page (before→after edits) — strongest possible proof.
- Secure the `shiftcut` GitHub org and `shiftcut.dev` domain.
