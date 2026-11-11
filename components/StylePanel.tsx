"use client";

import { memo, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { FONTS } from "@/lib/fonts";
import { DEFAULT_STYLE, type AnimEffect, type AnimMode, type CaptionStyle, type FontKey, type TextCase } from "@/lib/types";

const PRESETS: { name: string; style: CaptionStyle }[] = [
  { name: "Insta clean", style: DEFAULT_STYLE },
  {
    name: "Bold outline",
    style: { ...DEFAULT_STYLE, font: "poppins", weight: 800, letterSpacing: 0, fontScale: 5.5, strokeWidth: 14, shadow: false, posY: 72, animMode: "off" },
  },
  {
    name: "Hormozi",
    style: {
      ...DEFAULT_STYLE,
      font: "anton",
      letterSpacing: 0.01,
      fontScale: 7,
      textCase: "upper",
      strokeWidth: 16,
      shadowOpacity: 0.6,
      posY: 65,
      maxWidth: 70,
      animEffect: "pop",
      animDuration: 0.15,
      highlight: true,
    },
  },
  {
    name: "Box",
    style: { ...DEFAULT_STYLE, font: "interTight", weight: 600, fontScale: 4.2, shadow: false, boxOpacity: 0.65, posY: 80, animMode: "caption", animEffect: "fade" },
  },
  {
    name: "Minimal",
    style: { ...DEFAULT_STYLE, weight: 500, fontScale: 3.4, shadowOpacity: 0.35, posY: 86, maxWidth: 90, animMode: "caption", animEffect: "fade" },
  },
];

const WEIGHTS = [400, 500, 600, 700, 800, 900];

const COLOR_NAMES = {
  color: "Text color",
  shadowColor: "Shadow color",
  strokeColor: "Outline color",
  boxColor: "Box color",
  highlightColor: "Highlight color",
} as const;

interface Props {
  style: CaptionStyle;
  setStyle: Dispatch<SetStateAction<CaptionStyle>>;
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg-toggle">
      {options.map(([v, label]) => (
        <button key={v} className={value === v ? "on" : ""} aria-pressed={value === v} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Section({ title, toggle, children }: { title: string; toggle?: ReactNode; children: ReactNode }) {
  return (
    <div className="style-section">
      <div className="style-section-head">
        <span>{title}</span>
        {toggle}
      </div>
      {children}
    </div>
  );
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

function StylePanel({ style, setStyle }: Props) {
  const set = <K extends keyof CaptionStyle>(key: K, value: CaptionStyle[K]) => setStyle((s) => ({ ...s, [key]: value }));

  type NumKey = { [K in keyof CaptionStyle]: CaptionStyle[K] extends number ? K : never }[keyof CaptionStyle];
  const range = (key: NumKey, label: string, min: number, max: number, step: number, fmt = (v: number) => String(v), disabled = false) => (
    <div className="control">
      <label htmlFor={`st-${key}`}>
        <span>{label}</span>
        <span>{fmt(style[key])}</span>
      </label>
      <input
        id={`st-${key}`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={style[key]}
        disabled={disabled}
        onChange={(e) => set(key, parseFloat(e.target.value))}
      />
    </div>
  );

  const color = (key: "color" | "shadowColor" | "strokeColor" | "boxColor" | "highlightColor", disabled = false) => (
    <input type="color" aria-label={COLOR_NAMES[key]} value={style[key]} disabled={disabled} onChange={(e) => set(key, e.target.value)} />
  );

  const fixedWeight = FONTS[style.font]?.fixedWeight;

  return (
    <div className="style-panel">
      <div className="presets">
        {PRESETS.map((p) => (
          <button key={p.name} className="small" onClick={() => setStyle(p.style)}>
            {p.name}
          </button>
        ))}
      </div>

      <Section title="Text">
        <div className="controls">
          <div className="control">
            <label>
              <span>Font</span>
            </label>
            <select aria-label="Font" value={style.font} onChange={(e) => set("font", e.target.value as FontKey)}>
              {(Object.keys(FONTS) as FontKey[]).map((k) => (
                <option key={k} value={k}>
                  {FONTS[k].label}
                </option>
              ))}
            </select>
          </div>
          <div className="control">
            <label>
              <span>Weight</span>
            </label>
            <select aria-label="Weight" value={fixedWeight ?? style.weight} disabled={!!fixedWeight} onChange={(e) => set("weight", Number(e.target.value))}>
              {WEIGHTS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
          {range("fontScale", "Size", 2, 12, 0.1, (v) => v.toFixed(1))}
          {range("letterSpacing", "Letter spacing", -0.1, 0.15, 0.005, (v) => `${v.toFixed(3)}em`)}
          <div className="control">
            <label>
              <span>Color</span>
            </label>
            <div className="inline">{color("color")}</div>
          </div>
          <div className="control">
            <label>
              <span>Case</span>
            </label>
            <Segmented<TextCase>
              value={style.textCase}
              options={[
                ["none", "As spoken"],
                ["lower", "lower"],
                ["upper", "UPPER"],
              ]}
              onChange={(v) => set("textCase", v)}
            />
          </div>
        </div>
      </Section>

      <Section title="Position">
        <div className="controls">
          {range("posY", "Vertical position", 8, 94, 1, (v) => `${v}%`)}
          {range("maxWidth", "Line width", 30, 96, 1, (v) => `${v}%`)}
        </div>
      </Section>

      <Section title="Animation">
        <div className="control control-spaced">
          <Segmented<AnimMode>
            value={style.animMode}
            options={[
              ["word", "Word by word"],
              ["caption", "Whole caption"],
              ["off", "Off"],
            ]}
            onChange={(v) => set("animMode", v)}
          />
        </div>
        <div className="controls">
          <div className="control">
            <label>
              <span>Effect</span>
            </label>
            <select aria-label="Effect" value={style.animEffect} disabled={style.animMode === "off"} onChange={(e) => set("animEffect", e.target.value as AnimEffect)}>
              <option value="rise">Rise from below + blur</option>
              <option value="fade">Fade in</option>
              <option value="pop">Pop (scale up)</option>
            </select>
          </div>
          {range("animDuration", "Duration", 0.05, 0.6, 0.01, (v) => `${v.toFixed(2)}s`, style.animMode === "off")}
        </div>
      </Section>

      <Section title="Highlight spoken word" toggle={<Switch label="Highlight spoken word" checked={style.highlight} onChange={(v) => set("highlight", v)} />}>
        {style.highlight && (
          <div className="control">
            <div className="inline">
              {color("highlightColor")}
              <span className="muted small-note">Color of the word being said right now</span>
            </div>
          </div>
        )}
      </Section>

      <Section title="Drop shadow" toggle={<Switch label="Drop shadow" checked={style.shadow} onChange={(v) => set("shadow", v)} />}>
        {style.shadow && (
          <div className="controls">
            <div className="control">
              <label>
                <span>Color</span>
              </label>
              <div className="inline">{color("shadowColor")}</div>
            </div>
            {range("shadowOpacity", "Opacity", 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`)}
            {range("shadowBlur", "Blur", 0, 80, 1, (v) => `${v}`)}
            {range("shadowOffset", "Distance", 0, 20, 0.5, (v) => `${v}`)}
          </div>
        )}
      </Section>

      <Section title="Outline" toggle={<Switch label="Outline" checked={style.strokeWidth > 0} onChange={(v) => set("strokeWidth", v ? 12 : 0)} />}>
        {style.strokeWidth > 0 && (
          <div className="controls">
            <div className="control">
              <label>
                <span>Color</span>
              </label>
              <div className="inline">{color("strokeColor")}</div>
            </div>
            {range("strokeWidth", "Thickness", 1, 30, 1)}
          </div>
        )}
      </Section>

      <Section title="Background box" toggle={<Switch label="Background box" checked={style.boxOpacity > 0} onChange={(v) => set("boxOpacity", v ? 0.6 : 0)} />}>
        {style.boxOpacity > 0 && (
          <div className="controls">
            <div className="control">
              <label>
                <span>Color</span>
              </label>
              <div className="inline">{color("boxColor")}</div>
            </div>
            {range("boxOpacity", "Opacity", 0.05, 1, 0.05, (v) => `${Math.round(v * 100)}%`)}
          </div>
        )}
      </Section>
    </div>
  );
}

export default memo(StylePanel);
