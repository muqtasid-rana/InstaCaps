import type { Segment } from "./types";

// Voice-activity detection on the decoded audio. Gemini's timestamps are
// approximate (often a little late); the audio itself knows exactly when the
// voice starts, so we use it to snap caption and word timings.

export const FRAME = 0.01; // seconds per analysis frame

export interface SpeechMap {
  duration: number;
  level: Float32Array; // 0..1 loudness per frame, for the waveform
  voiced: Uint8Array; // 1 = speech
  prefix: Uint32Array; // prefix[i] = number of voiced frames in [0, i)
}

export function analyzeSpeech(samples: Float32Array, sampleRate: number): SpeechMap {
  const hop = Math.round(sampleRate * FRAME);
  const n = Math.max(1, Math.floor(samples.length / hop));
  const rms = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    const end = Math.min(samples.length, (i + 1) * hop);
    for (let j = i * hop; j < end; j++) {
      const x = samples[j] - 0.97 * prev; // pre-emphasis: favours speech over rumble and bass
      prev = samples[j];
      sum += x * x;
    }
    rms[i] = Math.sqrt(sum / hop);
  }

  const db = rms.map((r) => 20 * Math.log10(r + 1e-7));
  const sorted = db.slice().sort();
  const pct = (p: number) => sorted[Math.floor(p * (n - 1))];
  const floor = pct(0.1);
  const peak = pct(0.98);
  const threshold = floor + Math.max(8, (peak - floor) * 0.35);

  const voiced = new Uint8Array(n);
  for (let i = 0; i < n; i++) voiced[i] = db[i] > threshold ? 1 : 0;
  flipShortRuns(voiced, 0, 6); // bridge dips < 60 ms inside words
  flipShortRuns(voiced, 1, 4); // drop clicks < 40 ms

  const prefix = new Uint32Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + voiced[i];

  const ref = rms.slice().sort()[Math.floor(0.99 * (n - 1))] || 1;
  const level = rms.map((r) => Math.min(1, Math.sqrt(r / ref)));
  return { duration: n * FRAME, level, voiced, prefix };
}

/** Flip runs of `value` shorter than `maxLen` frames that sit between runs of the other value. */
function flipShortRuns(a: Uint8Array, value: 0 | 1, maxLen: number) {
  let i = 0;
  while (i < a.length) {
    if (a[i] !== value) {
      i++;
      continue;
    }
    let j = i;
    while (j < a.length && a[j] === value) j++;
    if (i > 0 && j < a.length && j - i < maxLen) a.fill(value ? 0 : 1, i, j);
    i = j;
  }
}

const frameAt = (map: SpeechMap, t: number) => Math.max(0, Math.min(map.voiced.length, Math.round(t / FRAME)));

/**
 * Word start times inside a caption, spread over the time the voice is
 * actually active (so pauses don't push words early), weighted by word length.
 * Returns null when there isn't enough detected speech to go on.
 */
export function voicedWordStarts(weights: number[], start: number, end: number, map: SpeechMap): number[] | null {
  const fa = frameAt(map, start);
  const fb = frameAt(map, end);
  const V = map.prefix[fb] - map.prefix[fa];
  if (V < 8) return null;
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  return weights.map((w) => {
    const k = Math.floor((V * acc) / total);
    acc += w;
    // first frame where the (k+1)-th voiced frame of this caption occurs
    let lo = fa;
    let hi = fb - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (map.prefix[mid + 1] - map.prefix[fa] > k) hi = mid;
      else lo = mid + 1;
    }
    return lo * FRAME;
  });
}

/**
 * Snap Gemini's caption timings to the voice:
 * 1. estimate a constant offset from captions that begin right after a pause,
 * 2. snap each start/end to the nearest voice onset/offset,
 * 3. tidy up: in order, no overlaps, tiny gaps closed so captions don't flicker.
 */
export function alignSegments<T extends Pick<Segment, "start" | "end">>(segs: T[], map: SpeechMap, duration: number): T[] {
  const v = map.voiced;
  const n = v.length;
  const onsets: number[] = [];
  const offsets: number[] = [];
  const strongOnsets: number[] = []; // onsets after >= 200 ms of silence
  let lastOffset = -Infinity;
  for (let i = 0; i < n; i++) {
    if (v[i] && (i === 0 || !v[i - 1])) {
      const t = i * FRAME;
      onsets.push(t);
      if (t - lastOffset >= 0.2) strongOnsets.push(t);
    }
    if (v[i] && (i === n - 1 || !v[i + 1])) {
      lastOffset = (i + 1) * FRAME;
      offsets.push(lastOffset);
    }
  }

  const nearest = (list: number[], t: number, lo: number, hi: number) => {
    let best: number | null = null;
    for (const x of list) if (x >= lo && x <= hi && (best === null || Math.abs(x - t) < Math.abs(best - t))) best = x;
    return best;
  };

  const out = [...segs].sort((a, b) => a.start - b.start).map((s) => ({ ...s }));
  const starts = out.map((s) => s.start);

  // 1. Constant offset (e.g. Gemini consistently ~200 ms late).
  const deltas: number[] = [];
  for (const o of strongOnsets) {
    const s = nearest(starts, o, o - 1, o + 1);
    if (s !== null) deltas.push(o - s);
  }
  deltas.sort((a, b) => a - b);
  const bias = deltas.length >= 3 ? deltas[Math.floor(deltas.length / 2)] : 0;
  for (const s of out) {
    s.start += bias;
    s.end += bias;
  }

  // 2. Snap to the voice.
  out.forEach((s, i) => {
    const prevStart = i > 0 ? out[i - 1].start : -Infinity;
    const nextStart = i < out.length - 1 ? out[i + 1].start : Infinity;
    const on = nearest(onsets, s.start, Math.max(s.start - 0.3, prevStart + 0.2), s.start + 0.3);
    if (on !== null) s.start = Math.max(0, on - 0.02);
    const off = nearest(offsets, s.end, Math.max(s.end - 0.3, s.start + 0.2), Math.min(s.end + 0.3, nextStart + 0.1));
    if (off !== null) s.end = off + 0.08;
  });

  // 3. Tidy.
  const r = (x: number) => Math.round(x * 1000) / 1000;
  out.forEach((s, i) => {
    const next = out[i + 1];
    s.start = Math.min(Math.max(0, s.start), Math.max(0, duration - 0.1));
    s.end = Math.min(Math.max(s.end, s.start + 0.2), duration);
    if (next) {
      if (next.start < s.start + 0.2) next.start = s.start + 0.2;
      if (s.end > next.start || next.start - s.end < 0.3) s.end = next.start;
    }
    s.start = r(s.start);
    s.end = r(s.end);
  });
  return out;
}
