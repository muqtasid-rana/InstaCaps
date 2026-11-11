"use client";

import { useEffect, useRef } from "react";

// A live caption timeline under the hero: what InstaCaps does, shown rather than told.
// The playhead stays in the middle and the clip slides under it; each word lights up as it's
// "spoken", and the caption line above follows. Drag to scrub. Purely decorative (aria-hidden).

const PHRASES = ["Yaar ye scene toh fire hai", "honestly best coffee in Lahore", "kal phir aayenge pakka", "follow karo for more"];
const PPS = 110; // pixels per second
const WORD_GAP = 0.06;
const PHRASE_GAP = 0.7;

type Word = { text: string; start: number; end: number; phrase: number; index: number };

const WORDS: Word[] = [];
let LOOP = 0.5;
PHRASES.forEach((p, pi) => {
  p.split(" ").forEach((text) => {
    const dur = 0.3 + text.length * 0.045;
    WORDS.push({ text, start: LOOP, end: LOOP + dur, phrase: pi, index: WORDS.length });
    LOOP += dur + WORD_GAP;
  });
  LOOP += PHRASE_GAP;
});
const COPIES = 3; // the clip is laid out three times so the strip never runs out while looping

// Small deterministic noise so the waveform looks like speech but renders the same every time.
function noise(i: number) {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export default function HeroTimeline() {
  const rootRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const waveRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current!;
    const win = windowRef.current!;
    const track = trackRef.current!;
    const canvas = waveRef.current!;
    const chips = [...track.querySelectorAll<HTMLElement>(".ht-chip")];
    const capWords = [...root.querySelectorAll<HTMLElement>(".ht-caption span")];
    const phrases = [...root.querySelectorAll<HTMLElement>(".ht-caption")];

    // Waveform: louder while a word is spoken, near-silent in the gaps.
    const drawWave = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.ceil(LOOP * PPS * COPIES);
      const h = canvas.clientHeight || 56;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = getComputedStyle(canvas).color;
      for (let x = 0, i = 0; x < w; x += 3, i++) {
        const t = (x / PPS) % LOOP;
        const word = WORDS.find((wd) => t >= wd.start && t < wd.end);
        let amp = 0.05 + noise(i) * 0.05;
        if (word) {
          const k = (t - word.start) / (word.end - word.start);
          amp = (0.3 + 0.7 * noise(i)) * Math.sin(Math.PI * Math.min(1, k * 1.15)) + 0.08;
        }
        const bh = Math.max(2, amp * h);
        ctx.fillRect(x, (h - bh) / 2, 2, bh);
      }
    };
    drawWave();
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", drawWave);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let t = reduce ? WORDS[3].start + 0.05 : 0;
    let last = performance.now();
    let active = -1;
    let activePhrase = -1;
    let dragging = false;
    let visible = true;
    let raf = 0;

    const render = () => {
      const x = win.clientWidth / 2 - (LOOP + t) * PPS;
      track.style.transform = `translate3d(${x}px,0,0)`;
      const word = WORDS.find((w) => t >= w.start && t < w.end);
      const idx = word ? word.index : -1;
      // Between words, keep the phrase that was just spoken on screen.
      const phrase = word ? word.phrase : activePhrase === -1 ? 0 : activePhrase;
      if (idx !== active) {
        chips.forEach((c) => c.classList.toggle("on", Number(c.dataset.i) === idx));
        capWords.forEach((c) => {
          const i = Number(c.dataset.i);
          c.classList.toggle("now", i === idx);
          c.classList.toggle("said", word ? i < idx && WORDS[i].phrase === phrase : WORDS[i].phrase === phrase && WORDS[i].end <= t);
        });
        active = idx;
      }
      if (phrase !== activePhrase) {
        phrases.forEach((p, i) => p.classList.toggle("show", i === phrase));
        activePhrase = phrase;
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!dragging && visible && !reduce) t = (t + dt) % LOOP;
      render();
      raf = requestAnimationFrame(tick);
    };
    render();
    raf = requestAnimationFrame(tick);

    // Pause while scrolled away or in a background tab.
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(root);

    // Drag to scrub.
    let startX = 0;
    let startT = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      startX = e.clientX;
      startT = t;
      win.setPointerCapture(e.pointerId);
      win.classList.add("dragging");
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      t = (((startT - (e.clientX - startX) / PPS) % LOOP) + LOOP) % LOOP;
    };
    const up = () => {
      dragging = false;
      win.classList.remove("dragging");
    };
    win.addEventListener("pointerdown", down);
    win.addEventListener("pointermove", move);
    win.addEventListener("pointerup", up);
    win.addEventListener("pointercancel", up);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      scheme.removeEventListener("change", drawWave);
      win.removeEventListener("pointerdown", down);
      win.removeEventListener("pointermove", move);
      win.removeEventListener("pointerup", up);
      win.removeEventListener("pointercancel", up);
    };
  }, []);

  return (
    <div className="ht" ref={rootRef} aria-hidden="true">
      <div className="ht-captions">
        {PHRASES.map((p, pi) => (
          <p key={pi} className="ht-caption">
            {WORDS.filter((w) => w.phrase === pi).map((w) => (
              <span key={w.index} data-i={w.index}>
                {w.text}
              </span>
            ))}
          </p>
        ))}
      </div>
      <div className="ht-window" ref={windowRef}>
        <div className="ht-track" ref={trackRef} style={{ width: Math.ceil(LOOP * PPS * COPIES) }}>
          <canvas ref={waveRef} className="ht-wave" />
          {Array.from({ length: COPIES }, (_, c) =>
            WORDS.map((w) => (
              <span
                key={`${c}-${w.index}`}
                className="ht-chip"
                data-i={w.index}
                style={{ left: (c * LOOP + w.start) * PPS, width: (w.end - w.start) * PPS - 2 }}
              >
                {w.text}
              </span>
            )),
          )}
        </div>
        <div className="ht-playhead" />
      </div>
    </div>
  );
}
