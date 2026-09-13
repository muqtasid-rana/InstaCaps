import { splitWords, wordTimes } from "./draw";
import type { SpeechMap } from "./speech";
import { uid, type ChunkMode, type Lang, type Segment } from "./types";

/** Most words on screen at once for each caption length setting. */
export const MAX_WORDS: Record<ChunkMode, number> = { short: 3, normal: 5 };

const GAP = 0.35; // captions closer together than this are one continuous stretch of speech
const PUNCT = /[.,!?;:]$/;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

interface Word {
  text: string;
  start: number;
  lang: Lang;
}

/**
 * Re-flow captions to the chosen length. Each run of continuous speech becomes
 * a stream of words (with voice-based timings) that is re-split into evenly
 * sized captions of at most MAX_WORDS words, preferring breaks after punctuation.
 * The model only roughly follows length instructions, so this enforces them.
 */
export function rechunk(segs: Segment[], mode: ChunkMode, speech: SpeechMap | null): Segment[] {
  const max = MAX_WORDS[mode];
  const empties = segs.filter((s) => !s.text.trim());
  const sorted = segs.filter((s) => s.text.trim()).sort((a, b) => a.start - b.start);
  const out: Segment[] = [];

  let i = 0;
  while (i < sorted.length) {
    const run = [sorted[i]];
    while (i + 1 < sorted.length && sorted[i + 1].start - run[run.length - 1].end < GAP) run.push(sorted[++i]);
    i++;

    const words: Word[] = [];
    for (const s of run) {
      const w = splitWords(s.text);
      const t = wordTimes(s, w, speech);
      w.forEach((text, k) => words.push({ text, start: t[k], lang: s.lang }));
    }
    const runStart = run[0].start;
    const runEnd = run[run.length - 1].end;

    // Evenly sized chunks (e.g. 7 words, max 5 → 4 + 3), then nudge each break by one word toward punctuation.
    const W = words.length;
    const k = Math.ceil(W / max);
    const bounds: number[] = [];
    let acc = 0;
    for (let c = 0; c < k - 1; c++) {
      acc += Math.ceil((W - acc) / (k - c));
      bounds.push(acc);
    }
    bounds.forEach((b, bi) => {
      const lo = bi ? bounds[bi - 1] : 0;
      const hi = bi < bounds.length - 1 ? bounds[bi + 1] : W;
      for (const p of [b, b - 1, b + 1]) {
        if (p - lo >= 1 && p - lo <= max && hi - p >= 1 && hi - p <= max && PUNCT.test(words[p - 1].text)) {
          bounds[bi] = p;
          break;
        }
      }
    });

    const edges = [0, ...bounds, W];
    for (let c = 0; c < edges.length - 1; c++) {
      const a = edges[c];
      const b = edges[c + 1];
      const chunk = words.slice(a, b);
      const start = c === 0 ? runStart : chunk[0].start;
      const end = b < W ? words[b].start : runEnd;
      out.push({
        id: c === 0 ? run[0].id : uid(),
        text: chunk.map((w) => w.text).join(" "),
        start: r3(start),
        end: r3(Math.max(end, start + 0.05)),
        lang: new Set(chunk.map((w) => w.lang)).size === 1 ? chunk[0].lang : "mixed",
      });
    }
  }

  return [...out, ...empties].sort((a, b) => a.start - b.start);
}
