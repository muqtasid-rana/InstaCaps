export type Lang = "en" | "ur" | "mixed";

export interface Segment {
  id: string;
  start: number; // seconds
  end: number; // seconds
  text: string;
  lang: Lang;
}

export type FontKey = "interTight" | "helvetica" | "poppins" | "montserrat" | "anton";
export type TextCase = "none" | "lower" | "upper";
export type AnimMode = "off" | "word" | "caption";
export type AnimEffect = "rise" | "fade" | "pop";

export interface CaptionStyle {
  font: FontKey;
  weight: number;
  letterSpacing: number; // em
  fontScale: number; // font size as % of video height
  color: string;
  textCase: TextCase;

  shadow: boolean;
  shadowColor: string;
  shadowOpacity: number; // 0..1
  shadowBlur: number; // % of font size
  shadowOffset: number; // % of font size, downward

  strokeColor: string;
  strokeWidth: number; // % of font size, 0 = off
  boxColor: string;
  boxOpacity: number; // 0..1, 0 = off

  posY: number; // vertical centre, % from top
  maxWidth: number; // % of video width before wrapping

  animMode: AnimMode; // off | word by word | whole caption at once
  animEffect: AnimEffect;
  animDuration: number; // seconds

  highlight: boolean; // colour the word being spoken
  highlightColor: string;
}

export type ChunkMode = "short" | "normal";

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  duration: number;
  segments: Segment[];
  style: CaptionStyle;
  chunkMode: ChunkMode;
}

export const MAX_SECONDS = 100;

/** Clean Instagram-style captions: tight Helvetica-like font, soft shadow, words rising in from a blur. */
export const DEFAULT_STYLE: CaptionStyle = {
  font: "interTight",
  weight: 600,
  letterSpacing: -0.045,
  fontScale: 3.6,
  color: "#ffffff",
  textCase: "none",

  shadow: true,
  shadowColor: "#000000",
  shadowOpacity: 0.45,
  shadowBlur: 22,
  shadowOffset: 4,

  strokeColor: "#000000",
  strokeWidth: 0,
  boxColor: "#000000",
  boxOpacity: 0,

  posY: 60,
  maxWidth: 80,

  animMode: "word",
  animEffect: "rise",
  animDuration: 0.2,

  highlight: false,
  highlightColor: "#ffe14d",
};

/** Look of projects saved before the style options existed. */
const LEGACY_STYLE: Partial<CaptionStyle> = {
  font: "poppins",
  weight: 800,
  letterSpacing: 0,
  shadow: false,
  animMode: "off",
};

/** Fill in fields missing from styles saved by older versions of the app. */
export function normalizeStyle(saved: Partial<CaptionStyle> & { uppercase?: boolean }): CaptionStyle {
  const base = "font" in saved ? DEFAULT_STYLE : { ...DEFAULT_STYLE, ...LEGACY_STYLE };
  const { uppercase, ...rest } = saved;
  return { ...base, ...rest, textCase: rest.textCase ?? (uppercase ? "upper" : "none") };
}

export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
