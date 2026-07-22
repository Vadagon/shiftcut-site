// Editor icon set — thin stroke, 20px grid, matches the reference UI.
import type { SVGProps } from "react";

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...p,
});

export const I = {
  folder: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
  ),
  audio: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M9 18V6l10-2v12" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></svg>
  ),
  text: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M5 6h14M12 6v12M9 18h6" /></svg>
  ),
  sticker: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01" /></svg>
  ),
  effects: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></svg>
  ),
  transitions: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="m7 7 5 5-5 5M13 7l5 5-5 5" /></svg>
  ),
  captions: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M8 11a2 2 0 1 0 0 2M16 11a2 2 0 1 0 0 2" /></svg>
  ),
  adjust: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M18 18h2" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="16" cy="18" r="2" /></svg>
  ),
  settings: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.4 2.6a7 7 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.4 2.6h5l.4-2.6a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5a7 7 0 0 0 .1-1Z" /></svg>
  ),
  list: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
  ),
  sort: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M7 4v16M7 20l-3-3M7 4l3 3M17 4v16M17 4l-3 3M17 20l3-3" /></svg>
  ),
  import: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M12 15V3M8 7l4-4 4 4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></svg>
  ),
  play: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M7 4v16l13-8z" fill="currentColor" stroke="none" /></svg>
  ),
  pause: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" /></svg>
  ),
  fullscreen: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" /></svg>
  ),
  chevronDown: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>
  ),
  link: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /></svg>
  ),
  cut: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path d="M8 8 20 18M8 16 20 6" /></svg>
  ),
  duplicate: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
  ),
  trash: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg>
  ),
  alignL: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M4 4v16" /><rect x="7" y="8" width="11" height="8" rx="1" /></svg>
  ),
  alignR: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M20 4v16" /><rect x="6" y="8" width="11" height="8" rx="1" /></svg>
  ),
  bookmark: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M6 4h12v16l-6-4-6 4z" /></svg>
  ),
  graph: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M4 18 9 9l4 5 3-8 4 12" /></svg>
  ),
  layers: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5M3 17l9 5 9-5" /></svg>
  ),
  magnet: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M6 4v7a6 6 0 0 0 12 0V4M6 4H2m4 0v4H2m20-4h-4m4 0v4h-4" /></svg>
  ),
  fit: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M3 12h18M3 12l4-4M3 12l4 4M21 12l-4-4M21 12l-4 4" /></svg>
  ),
  zoomIn: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3M11 8v6M8 11h6" /></svg>
  ),
  zoomOut: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3M8 11h6" /></svg>
  ),
  volume: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M4 9v6h4l5 4V5L8 9zM16 9a3 3 0 0 1 0 6M18.5 7a6 6 0 0 1 0 10" /></svg>
  ),
  volumeMute: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M4 9v6h4l5 4V5L8 9zM22 9l-5 6M17 9l5 6" /></svg>
  ),
  eye: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="2.5" /></svg>
  ),
  eyeOff: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M4 4l16 16M9.5 9.5a2.5 2.5 0 0 0 3 3M6.5 6.7C3.8 8.2 2 12 2 12s3.5 7 10 7a10 10 0 0 0 4-.8M9.5 5.2A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3" /></svg>
  ),
  lock: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
  ),
  transform: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3" /></svg>
  ),
  speed: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M12 20a8 8 0 1 0-8-8M12 12l4-3" /><path d="M4 12H2m4-6L5 5" /></svg>
  ),
  opacity: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none" /></svg>
  ),
  sun: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" /></svg>
  ),
  diamond: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="m12 3 4 9-4 9-4-9z" /></svg>
  ),
  export: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M12 15V4M8.5 7.5 12 4l3.5 3.5M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></svg>
  ),
  undo: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="M9 7 4 12l5 5M4 12h11a5 5 0 0 1 0 10h-1" /></svg>
  ),
  redo: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}><path d="m15 7 5 5-5 5M20 12H9a5 5 0 0 0 0 10h1" /></svg>
  ),
};
