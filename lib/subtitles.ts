import type { Segment } from "./types";

function stamp(t: number, sep: "," | ".") {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(ms % 1000, 3)}`;
}

const sorted = (segments: Segment[]) => [...segments].filter((s) => s.text.trim()).sort((a, b) => a.start - b.start);

export function toSRT(segments: Segment[]) {
  return sorted(segments)
    .map((s, i) => `${i + 1}\n${stamp(s.start, ",")} --> ${stamp(s.end, ",")}\n${s.text}\n`)
    .join("\n");
}

export function toVTT(segments: Segment[]) {
  return "WEBVTT\n\n" + sorted(segments).map((s) => `${stamp(s.start, ".")} --> ${stamp(s.end, ".")}\n${s.text}\n`).join("\n");
}

export function toTXT(segments: Segment[]) {
  return sorted(segments).map((s) => s.text).join(" ");
}

/** m:ss.d (digits = decimals on the seconds). */
export function fmtTime(t: number, digits = 1) {
  const safe = Math.max(0, t);
  const m = Math.floor(safe / 60);
  const s = (safe - m * 60).toFixed(digits).padStart(digits ? 3 + digits : 2, "0");
  return `${m}:${s}`;
}

/** Start a download of an object URL. The caller decides when to revoke it. */
export function saveUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function download(data: Blob | string, filename: string) {
  const blob = typeof data === "string" ? new Blob([data], { type: "text/plain;charset=utf-8" }) : data;
  const url = URL.createObjectURL(blob);
  saveUrl(url, filename);
  // Revoking early makes the browser's download fail with "Network error" (e.g. while a
  // "Save as" / "Download file?" prompt is open, or a big file is still being written).
  setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
}
