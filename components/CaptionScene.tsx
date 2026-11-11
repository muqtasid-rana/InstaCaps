"use client";

import { useEffect, useState } from "react";

// The picture on the login/sign-up screens: a reel frame on a red studio backdrop, with captions
// landing word by word the way InstaCaps renders them (rise + blur, spoken word highlighted).
const PHRASES = [
  ["Yaar", "ye", "scene", "toh", "fire", "hai"],
  ["honestly", "best", "coffee", "in", "Lahore"],
  ["kal", "phir", "aayenge,", "pakka"],
];
const WORD_MS = 340;
const HOLD_MS = 1100;

export default function CaptionScene() {
  const [phrase, setPhrase] = useState(0);
  const [word, setWord] = useState(PHRASES[0].length - 1);
  const [still, setStill] = useState(true);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;
    setStill(false);
    let p = 0;
    let w = -1;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (document.hidden) {
        timer = setTimeout(step, 500);
        return;
      }
      w += 1;
      if (w >= PHRASES[p].length) {
        p = (p + 1) % PHRASES.length;
        w = 0;
      }
      setPhrase(p);
      setWord(w);
      timer = setTimeout(step, w === PHRASES[p].length - 1 ? WORD_MS + HOLD_MS : WORD_MS);
    };
    timer = setTimeout(step, 400);
    return () => clearTimeout(timer);
  }, []);

  const words = PHRASES[phrase];
  const total = PHRASES.reduce((n, p) => n + p.length, 0);
  const done = PHRASES.slice(0, phrase).reduce((n, p) => n + p.length, 0) + word + 1;

  return (
    <div className="scene" aria-hidden="true">
      <div className="scene-light" />
      {/* A backlit subject, slightly soft, like the reel is shot against a red backdrop. */}
      <svg className="scene-subject" viewBox="0 0 400 500" preserveAspectRatio="xMidYMax meet">
        <defs>
          <linearGradient id="rim" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ff5a6e" stopOpacity="0.55" />
            <stop offset="0.18" stopColor="#140206" stopOpacity="0" />
            <stop offset="0.82" stopColor="#140206" stopOpacity="0" />
            <stop offset="1" stopColor="#ff5a6e" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        <g>
          <path
            d="M200 92c-38 0-66 31-66 76 0 30 11 55 28 70v26c-58 10-104 46-120 118-6 28-8 64-8 118h332c0-54-2-90-8-118-16-72-62-108-120-118v-26c17-15 28-40 28-70 0-45-28-76-66-76z"
            fill="#140206"
          />
          <path
            d="M200 92c-38 0-66 31-66 76 0 30 11 55 28 70v26c-58 10-104 46-120 118-6 28-8 64-8 118h332c0-54-2-90-8-118-16-72-62-108-120-118v-26c17-15 28-40 28-70 0-45-28-76-66-76z"
            fill="url(#rim)"
          />
        </g>
      </svg>
      <div className="scene-grain" />
      <div className="scene-side">
        <span>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round">
            <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
          </svg>
          12.4K
        </span>
        <span>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round">
            <path d="M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.2A8 8 0 1 1 20 11.5z" />
          </svg>
          318
        </span>
        <span>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round">
            <path d="M21 4 10 14M21 4l-7 17-4-7-7-4z" />
          </svg>
          96
        </span>
      </div>
      <div className="scene-meta">
        <span className="scene-avatar" />
        <span>
          <strong>@zara.eats</strong>
          <small>Original audio</small>
        </span>
      </div>
      <p className={`scene-caption${still ? " still" : ""}`} key={phrase}>
        {words.map((w, i) => (
          <span key={i} className={`${i <= word ? "shown" : ""}${i === word ? " now" : ""}`}>
            {w}
          </span>
        ))}
      </p>
      <div className="scene-progress">
        <span style={{ transform: `scaleX(${done / total})` }} />
      </div>
    </div>
  );
}
