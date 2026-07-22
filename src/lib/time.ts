// Time / timecode helpers.

export function fmtTimecode(sec = 0, fps = 30): string {
  const total = Math.max(0, sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const f = Math.floor((total - Math.floor(total)) * fps);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(s)}:${p(f)}`;
}

export function fmtDuration(sec = 0): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Snap a time to the nearest frame boundary for the given fps.
export function snapTimeToFrame(time: number, fps: number): number {
  if (!fps) return time;
  return Math.round(time * fps) / fps;
}
