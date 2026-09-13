import { FONTS } from "./fonts";
import { voicedWordStarts, type SpeechMap } from "./speech";
import type { CaptionStyle, Segment, TextCase } from "./types";

// One renderer for both the live preview and the exported video, so what you
// see in the editor is exactly what ends up in the file.
//
// Speed: every word is rendered once into a small sprite (text, outline,
// shadow, and a few pre-blurred steps for the entrance animation) and reused,
// so a frame is just a handful of drawImage calls instead of re-running
// blur/shadow filters over the whole frame.

/** Animations start this fraction of their duration before the word is spoken, so words land on the beat. */
const ANTICIPATION = 0.6;
const BLUR_STEPS = 6;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeOutBack = (x: number) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);

function rgba(hex: string, alpha: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function applyCase(text: string, c: TextCase) {
  return c === "upper" ? text.toUpperCase() : c === "lower" ? text.toLowerCase() : text;
}

/** CSS font shorthand for a style at a given pixel size (also used to preload the font). */
export function fontSpec(style: CaptionStyle, px = 40) {
  const f = FONTS[style.font] ?? FONTS.interTight;
  return `${f.fixedWeight ?? style.weight} ${px}px ${f.family}`;
}

export const splitWords = (text: string) => text.split(/\s+/).filter(Boolean);

// ---------- timing ----------

const timesCache = new WeakMap<Segment, { key: string; speech: SpeechMap | null; times: number[] }>();

/** When each word of a caption is spoken: from the detected voice when available, else spread by word length. */
export function wordTimes(seg: Segment, words: string[], speech: SpeechMap | null) {
  const key = words.join(" ");
  const hit = timesCache.get(seg);
  if (hit && hit.key === key && hit.speech === speech) return hit.times;

  const weights = words.map((w) => w.length + 2);
  let times = speech ? voicedWordStarts(weights, seg.start, seg.end, speech) : null;
  if (!times) {
    const total = weights.reduce((a, b) => a + b, 0);
    let acc = 0;
    times = weights.map((w) => {
      const t = seg.start + ((seg.end - seg.start) * acc) / total;
      acc += w;
      return t;
    });
  }
  timesCache.set(seg, { key, speech, times });
  return times;
}

/** The caption on screen at time t (a new caption may appear a touch early so its entrance lands on the word). */
export function captionAt(segments: Segment[], t: number, style: CaptionStyle) {
  const pre = style.animMode === "off" ? 0 : style.animDuration * ANTICIPATION;
  let hit: Segment | undefined;
  for (const s of segments) if (t >= s.start - pre && t < s.end && (!hit || s.start > hit.start)) hit = s;
  return hit;
}

// ---------- sprites ----------

interface Sprite {
  img: HTMLCanvasElement;
  ox: number; // where the word's left edge sits inside the sprite
  oy: number; // where the word's vertical centre sits inside the sprite
}

const sprites = new Map<string, Sprite>();
const widths = new Map<string, number>();
let measureCtx: CanvasRenderingContext2D | null = null;

if (typeof document !== "undefined") {
  // A font finished downloading: anything drawn with the fallback font is stale.
  document.fonts?.addEventListener("loadingdone", () => {
    sprites.clear();
    widths.clear();
  });
}

function newCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

function setFont(ctx: CanvasRenderingContext2D, style: CaptionStyle, fontSize: number) {
  ctx.font = fontSpec(style, fontSize);
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${style.letterSpacing * fontSize}px`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
}

function remember<T>(map: Map<string, T>, key: string, value: T, max: number) {
  if (map.size >= max) map.clear();
  map.set(key, value);
  return value;
}

function measure(word: string, style: CaptionStyle, fontSize: number) {
  const key = `${word}|${fontSpec(style, fontSize)}|${style.letterSpacing}`;
  const hit = widths.get(key);
  if (hit !== undefined) return hit;
  measureCtx ??= newCanvas(1, 1).getContext("2d")!;
  setFont(measureCtx, style, fontSize);
  return remember(widths, key, measureCtx.measureText(word).width, 5000);
}

const blurPx = (fontSize: number, step: number) => (fontSize * 0.12 * step) / (BLUR_STEPS - 1);

function textSprite(word: string, style: CaptionStyle, fontSize: number, color: string, step: number): Sprite {
  const key = `t|${word}|${fontSpec(style, fontSize)}|${style.letterSpacing}|${color}|${style.strokeWidth}|${style.strokeColor}|${step}`;
  const hit = sprites.get(key);
  if (hit) return hit;

  const width = measure(word, style, fontSize);
  const blur = blurPx(fontSize, step);
  const stroke = style.strokeWidth > 0 ? (fontSize * style.strokeWidth) / 100 : 0;
  const pad = Math.ceil(stroke / 2 + blur * 2.5 + fontSize * 0.25);
  const img = newCanvas(width + pad * 2, fontSize * 1.4 + pad * 2);
  const ctx = img.getContext("2d")!;
  setFont(ctx, style, fontSize);
  if (blur > 0) ctx.filter = `blur(${blur.toFixed(2)}px)`;
  const y = img.height / 2;
  if (stroke) {
    ctx.lineWidth = stroke;
    ctx.lineJoin = "round";
    ctx.strokeStyle = style.strokeColor;
    ctx.strokeText(word, pad, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(word, pad, y);
  return remember(sprites, key, { img, ox: pad, oy: y }, 1500);
}

/** Just the shadow of a word (drawn under all words first, so a shadow never darkens the neighbouring word). */
function shadowSprite(word: string, style: CaptionStyle, fontSize: number, step: number): Sprite {
  const key = `s|${word}|${fontSpec(style, fontSize)}|${style.letterSpacing}|${style.strokeWidth}|${style.shadowColor}|${style.shadowOpacity}|${style.shadowBlur}|${style.shadowOffset}|${step}`;
  const hit = sprites.get(key);
  if (hit) return hit;

  const base = textSprite(word, style, fontSize, "#000000", 0);
  const blur = blurPx(fontSize, step);
  const sb = (fontSize * style.shadowBlur) / 100;
  const so = (fontSize * style.shadowOffset) / 100;
  const pad = Math.ceil(sb * 1.5 + so + blur * 2.5);
  const img = newCanvas(base.img.width + pad * 2, base.img.height + pad * 2);
  const ctx = img.getContext("2d")!;
  if (blur > 0) ctx.filter = `blur(${blur.toFixed(2)}px)`;
  // Draw the text far off-canvas and offset only its shadow back into view.
  const far = img.width + 100;
  ctx.shadowColor = rgba(style.shadowColor, style.shadowOpacity);
  ctx.shadowBlur = sb;
  ctx.shadowOffsetX = far;
  ctx.shadowOffsetY = so;
  ctx.drawImage(base.img, pad - far, pad);
  return remember(sprites, key, { img, ox: base.ox + pad, oy: base.oy + pad }, 1500);
}

// ---------- layout ----------

interface Layout {
  words: string[];
  x: number[];
  y: number[];
  w: number[];
  lines: { x: number; y: number; w: number }[];
  lineH: number;
  fontSize: number;
}

const layoutCache = new WeakMap<Segment, { style: CaptionStyle; W: number; H: number; layout: Layout }>();

function layoutFor(seg: Segment, style: CaptionStyle, W: number, H: number): Layout {
  const hit = layoutCache.get(seg);
  if (hit && hit.style === style && hit.W === W && hit.H === H) return hit.layout;

  const words = splitWords(applyCase(seg.text, style.textCase));
  const fontSize = Math.max(6, Math.round((H * style.fontScale) / 100));
  const w = words.map((wd) => measure(wd, style, fontSize));
  const space = measure(" ", style, fontSize);
  const maxW = (W * style.maxWidth) / 100;

  // Lay out the full caption once so words appear in their final spot and nothing jumps around.
  const rows: number[][] = [];
  let cur: number[] = [];
  let curW = 0;
  words.forEach((_, i) => {
    const add = (cur.length ? space : 0) + w[i];
    if (cur.length && curW + add > maxW) {
      rows.push(cur);
      cur = [i];
      curW = w[i];
    } else {
      cur.push(i);
      curW += add;
    }
  });
  if (cur.length) rows.push(cur);

  const lineH = fontSize * 1.2;
  const top = (H * style.posY) / 100 - ((rows.length - 1) * lineH) / 2;
  const x: number[] = [];
  const y: number[] = [];
  const lines: Layout["lines"] = [];
  rows.forEach((row, li) => {
    const lw = row.reduce((s, i, k) => s + w[i] + (k ? space : 0), 0);
    const ly = top + li * lineH;
    let lx = W / 2 - lw / 2;
    lines.push({ x: lx, y: ly, w: lw });
    for (const i of row) {
      x[i] = lx;
      y[i] = ly;
      lx += w[i] + space;
    }
  });

  const layout = { words, x, y, w, lines, lineH, fontSize };
  layoutCache.set(seg, { style, W, H, layout });
  return layout;
}

// ---------- drawing ----------

export function drawCaption(
  ctx: CanvasRenderingContext2D,
  seg: Segment,
  t: number,
  style: CaptionStyle,
  W: number,
  H: number,
  speech: SpeechMap | null = null,
) {
  const L = layoutFor(seg, style, W, H);
  if (!L.words.length) return;
  const { fontSize } = L;

  const spoken = wordTimes(seg, L.words, speech);
  const dur = Math.max(0.01, style.animDuration);
  const lead = dur * ANTICIPATION;
  const progress = L.words.map((_, i) => {
    if (style.animMode === "off") return 1;
    const start = style.animMode === "word" ? spoken[i] : seg.start;
    return clamp01((t - (start - lead)) / dur);
  });
  let active = -1;
  if (style.highlight) spoken.forEach((s, i) => t >= s - 0.03 && (active = i));

  ctx.save();

  if (style.boxOpacity > 0 && progress[0] > 0) {
    const padX = fontSize * 0.4;
    ctx.globalAlpha = easeOutCubic(progress[0]);
    ctx.fillStyle = rgba(style.boxColor, style.boxOpacity);
    for (const b of L.lines) {
      ctx.beginPath();
      ctx.roundRect(b.x - padX, b.y - L.lineH / 2, b.w + padX * 2, L.lineH, fontSize * 0.2);
      ctx.fill();
    }
  }

  const passes: ("shadow" | "text")[] = style.shadow && style.shadowOpacity > 0 ? ["shadow", "text"] : ["text"];
  for (const pass of passes) {
    L.words.forEach((word, i) => {
      const p = progress[i];
      if (p <= 0) return;
      const e = easeOutCubic(p);
      let dy = 0;
      let step = 0;
      let scale = 1;
      if (p < 1) {
        if (style.animEffect === "rise") {
          dy = (1 - e) * fontSize * 0.45;
          step = Math.round((1 - e) * (BLUR_STEPS - 1));
        } else if (style.animEffect === "pop") {
          scale = 0.5 + 0.5 * easeOutBack(p);
        }
      }
      const sp =
        pass === "shadow"
          ? shadowSprite(word, style, fontSize, step)
          : textSprite(word, style, fontSize, i === active ? style.highlightColor : style.color, step);

      ctx.globalAlpha = e;
      if (scale !== 1) {
        ctx.save();
        ctx.translate(L.x[i] + L.w[i] / 2, L.y[i] + dy);
        ctx.scale(scale, scale);
        ctx.drawImage(sp.img, -L.w[i] / 2 - sp.ox, -sp.oy);
        ctx.restore();
      } else {
        ctx.drawImage(sp.img, L.x[i] - sp.ox, L.y[i] + dy - sp.oy);
      }
    });
  }

  ctx.restore();
}

/** Draw whichever caption is on screen at time t. Returns it (or null). */
export function renderCaptions(
  ctx: CanvasRenderingContext2D,
  segments: Segment[],
  t: number,
  style: CaptionStyle,
  W: number,
  H: number,
  speech: SpeechMap | null = null,
) {
  const seg = captionAt(segments, t, style);
  if (seg) drawCaption(ctx, seg, t, style, W, H, speech);
  return seg ?? null;
}
