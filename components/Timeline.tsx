"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { Clock } from "@/lib/clock";
import type { SetWithHistory } from "@/lib/history";
import { FRAME, type SpeechMap } from "@/lib/speech";
import type { Segment } from "@/lib/types";

interface Props {
  duration: number;
  segments: Segment[];
  setSegments: SetWithHistory<Segment[]>;
  speech: SpeechMap | null;
  clock: Clock;
  seek: (t: number) => void;
  activeId: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  toolbar: ReactNode;
}

const PAD = 16; // px of empty track on each side
const MIN_LEN = 0.1;
const WAVE_H = 60;
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export default function Timeline({ duration, segments, setSegments, speech, clock, seek, activeId, selectedId, onSelect, toolbar }: Props) {
  const [pps, setPps] = useState(90); // pixels per second
  const scrollRef = useRef<HTMLDivElement>(null);
  const waveRef = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const width = Math.ceil(duration * pps);
  const toX = (t: number) => PAD + t * pps;
  const toT = (clientX: number) => {
    const sc = scrollRef.current!;
    return clamp((clientX - sc.getBoundingClientRect().left + sc.scrollLeft - PAD) / pps, 0, duration);
  };

  // Waveform
  useEffect(() => {
    const c = waveRef.current;
    if (!c) return;
    c.width = width;
    c.height = WAVE_H;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (!speech) return;
    ctx.fillStyle = getComputedStyle(c).color;
    const n = speech.level.length;
    for (let x = 0; x < width; x++) {
      const f0 = Math.floor(x / pps / FRAME);
      const f1 = Math.max(f0 + 1, Math.floor((x + 1) / pps / FRAME));
      let m = 0;
      for (let f = f0; f < f1 && f < n; f++) m = Math.max(m, speech.level[f]);
      const h = Math.max(1, m * (WAVE_H - 6));
      ctx.fillRect(x, (WAVE_H - h) / 2, 1, h);
    }
  }, [speech, pps, width]);

  // Playhead follows the clock without re-rendering; the view scrolls along while playing.
  useEffect(
    () =>
      clock.subscribe((t) => {
        const ph = playheadRef.current;
        const sc = scrollRef.current;
        if (!ph || !sc) return;
        const x = PAD + t * pps;
        ph.style.transform = `translateX(${x}px)`;
        if (clock.playing && !dragging.current && (x < sc.scrollLeft + 40 || x > sc.scrollLeft + sc.clientWidth - 60)) {
          sc.scrollLeft = x - 60;
        }
      }),
    [clock, pps],
  );

  // Ctrl/⌘ + wheel zooms (needs a non-passive listener to stop the page zooming).
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setPps((p) => clamp(p * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 15, 320));
    };
    sc.addEventListener("wheel", onWheel, { passive: false });
    return () => sc.removeEventListener("wheel", onWheel);
  }, []);

  const trackPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest(".tl-block")) return;
    onSelect(null);
    dragging.current = true;
    seek(toT(e.clientX));
    const move = (ev: PointerEvent) => seek(toT(ev.clientX));
    const up = () => {
      dragging.current = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const startDrag = (e: ReactPointerEvent, seg: Segment, mode: "move" | "start" | "end") => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(seg.id);

    const sorted = [...segments].sort((a, b) => a.start - b.start);
    const i = sorted.findIndex((s) => s.id === seg.id);
    const lo = Math.min(seg.start, sorted[i - 1]?.end ?? 0);
    const hi = Math.max(seg.end, sorted[i + 1]?.start ?? duration);
    const x0 = e.clientX;
    const key = `drag-${seg.id}-${Date.now()}`;
    let moved = false;
    dragging.current = true;

    const move = (ev: PointerEvent) => {
      if (!moved && Math.abs(ev.clientX - x0) < 3) return;
      moved = true;
      const dt = (ev.clientX - x0) / pps;
      let { start, end } = seg;
      if (mode === "move") {
        const len = end - start;
        start = clamp(start + dt, lo, hi - len);
        end = start + len;
      } else if (mode === "start") {
        start = clamp(start + dt, lo, end - MIN_LEN);
      } else {
        end = clamp(end + dt, start + MIN_LEN, hi);
      }
      setSegments((list) => list.map((s) => (s.id === seg.id ? { ...s, start: r3(start), end: r3(end) } : s)), key);
      seek(mode === "end" ? end - 0.02 : start); // show the frame at the edge being moved
    };
    const up = () => {
      dragging.current = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (!moved) seek(seg.start + 0.001);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const step = pps >= 150 ? 0.5 : pps >= 50 ? 1 : pps >= 25 ? 2 : 5;
  const ticks: number[] = [];
  for (let t = 0; t <= duration + 1e-6; t += step) ticks.push(Math.round(t * 10) / 10);

  return (
    <div className="timeline">
      <div className="tl-bar">
        {toolbar}
        <label className="tl-zoom" title="Zoom (Ctrl + scroll)">
          <span className="muted">Zoom</span>
          <input type="range" min={15} max={320} value={pps} onChange={(e) => setPps(Number(e.target.value))} />
        </label>
      </div>
      <div className="tl-scroll" ref={scrollRef} onPointerDown={trackPointerDown}>
        <div className="tl-inner" style={{ width: width + PAD * 2 }}>
          <div className="tl-ruler">
            {ticks.map((t) => (
              <div key={t} className="tl-tick" style={{ left: toX(t) }}>
                {Number.isInteger(t) ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}` : ""}
              </div>
            ))}
          </div>
          <canvas ref={waveRef} className="tl-wave" style={{ left: PAD, width }} />
          {segments.map((s) => (
            <div
              key={s.id}
              className={`tl-block ${s.lang}${s.id === activeId ? " active" : ""}${s.id === selectedId ? " selected" : ""}`}
              style={{ left: toX(s.start), width: Math.max(6, (s.end - s.start) * pps) }}
              onPointerDown={(e) => startDrag(e, s, "move")}
              title={s.text}
            >
              <span className="tl-h tl-h-l" onPointerDown={(e) => startDrag(e, s, "start")} />
              <span className="tl-txt">{s.text}</span>
              <span className="tl-h tl-h-r" onPointerDown={(e) => startDrag(e, s, "end")} />
            </div>
          ))}
          <div className="tl-playhead" ref={playheadRef} />
        </div>
      </div>
    </div>
  );
}
