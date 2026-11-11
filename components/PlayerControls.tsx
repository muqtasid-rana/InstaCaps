"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Clock } from "@/lib/clock";
import { fmtTime } from "@/lib/subtitles";
import Icon from "./Icon";

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  clock: Clock;
  duration: number;
  onToggle: () => void;
  seek: (t: number) => void;
}

export default function PlayerControls({ videoRef, clock, duration, onToggle, seek }: Props) {
  const timeRef = useRef<HTMLSpanElement>(null);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [muted, setMuted] = useState(false);

  // Time display follows the playhead without re-rendering.
  useEffect(
    () =>
      clock.subscribe((t) => {
        if (timeRef.current) timeRef.current.textContent = fmtTime(t, 2);
      }),
    [clock],
  );

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const sync = () => setPlaying(!v.paused);
    v.addEventListener("play", sync);
    v.addEventListener("pause", sync);
    v.addEventListener("ended", sync);
    return () => {
      v.removeEventListener("play", sync);
      v.removeEventListener("pause", sync);
      v.removeEventListener("ended", sync);
    };
  }, [videoRef]);

  const stepFrame = (d: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    seek(v.currentTime + d);
  };

  return (
    <div className="controls-bar">
      <button className="icon-btn to-start" onClick={() => seek(0)} aria-label="Go to start" title="Go to start">
        <Icon name="start" />
      </button>
      <button className="icon-btn" onClick={() => stepFrame(-1 / 30)} aria-label="Previous frame" title="Previous frame">
        <Icon name="prev" />
      </button>
      <button className="icon-btn play" onClick={onToggle} aria-label={playing ? "Pause" : "Play"} title="Play / pause (Space)">
        <Icon name={playing ? "pause" : "play"} />
      </button>
      <button className="icon-btn" onClick={() => stepFrame(1 / 30)} aria-label="Next frame" title="Next frame">
        <Icon name="next" />
      </button>
      <span className="time">
        <span ref={timeRef}>0:00.00</span> <span className="muted">/ {fmtTime(duration, 2)}</span>
      </span>
      <span className="spacer" />
      <select
        value={rate}
        aria-label="Playback speed"
        title="Playback speed"
        onChange={(e) => {
          const r = Number(e.target.value);
          setRate(r);
          if (videoRef.current) videoRef.current.playbackRate = r;
        }}
      >
        {RATES.map((r) => (
          <option key={r} value={r}>
            {r}×
          </option>
        ))}
      </select>
      <button
        className="icon-btn"
        aria-label={muted ? "Unmute" : "Mute"}
        title={muted ? "Unmute" : "Mute"}
        onClick={() => {
          const v = videoRef.current;
          if (!v) return;
          v.muted = !v.muted;
          setMuted(v.muted);
        }}
      >
        <Icon name={muted ? "mute" : "volume"} />
      </button>
    </div>
  );
}
