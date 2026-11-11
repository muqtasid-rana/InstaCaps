"use client";

import { gsap } from "gsap";
import { useEffect, useRef } from "react";

// Behind the hero: a field of faint caption lines drifting past, the kind of things people say in
// their reels. Every couple of seconds one phrase is "spoken" and lights up word by word, the way
// InstaCaps lands captions. Rows sit at different depths and lean away from the cursor.
// Decorative only (aria-hidden); still under reduced motion; paused when scrolled away.

const PHRASES = [
  "yaar ye scene toh fire hai",
  "honestly best coffee in Lahore",
  "kal phir aayenge pakka",
  "follow karo for more",
  "ammi ko mat batana",
  "bhai ye kya scene hai",
  "weekend vlog part 2",
  "chai ke bina guzara nahi",
  "ye wala trend try karo",
  "Karachi ki baarish",
  "aaj ka outfit check",
  "plan cancel ho gaya",
  "late night drive with the boys",
  "sab theek ho jayega",
  "honest review, no sponsor",
  "kitna mehnga ho gaya hai",
  "Lahore food street, round two",
  "ruko zara, sabar karo",
];

const ROWS = 8;

// Each row gets its own run of phrases (offset so neighbouring rows don't repeat).
function rowPhrases(r: number) {
  return Array.from({ length: 6 }, (_, i) => PHRASES[(r * 5 + i * 3) % PHRASES.length]);
}

export default function HeroField() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      const rows = gsap.utils.toArray<HTMLElement>(".hf-row", el);
      const tracks = gsap.utils.toArray<HTMLElement>(".hf-track", el);

      // Entrance: rows rise in, top to bottom, after the headline has landed.
      gsap.from(rows, { autoAlpha: 0, y: 14, duration: 1.1, ease: "power3.out", stagger: 0.07, delay: 0.5 });
      if (reduce) return;

      // Endless drift: each track holds its phrases twice, so moving it by half its width loops seamlessly.
      const drifts = tracks.map((track, i) =>
        gsap.fromTo(
          track,
          { xPercent: i % 2 ? -50 : 0 },
          { xPercent: i % 2 ? 0 : -50, duration: 70 + (i % 4) * 14, ease: "none", repeat: -1 },
        ),
      );

      // Depth: rows lean away from the pointer by different amounts.
      const depth = rows.map((row, i) => ({
        x: gsap.quickTo(row, "x", { duration: 1.2, ease: "power3.out" }),
        y: gsap.quickTo(row, "y", { duration: 1.2, ease: "power3.out" }),
        k: 6 + ((i * 7) % 5) * 5,
      }));
      const onMove = (e: PointerEvent) => {
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        depth.forEach((d) => {
          d.x(-nx * d.k);
          d.y(-ny * d.k * 0.4);
        });
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      // "Speaking": light up one visible phrase word by word, hold it, then let it settle.
      const css = getComputedStyle(el);
      const play = () => css.getPropertyValue("--h-play").trim() || "#e1306c";
      const ink = () => css.getPropertyValue("--h-text").trim() || "#0a0a0a";
      let speaking: gsap.core.Timeline | null = null;
      const speak = () => {
        const bounds = el.getBoundingClientRect();
        // Never light up a phrase behind the headline, the intro line or the button.
        const keepClear = [...(el.parentElement?.querySelectorAll("h1, .lede, .upload, .meta") ?? [])].map((n) => n.getBoundingClientRect());
        const overlaps = (r: DOMRect) => keepClear.some((k) => r.left < k.right + 16 && r.right > k.left - 16 && r.top < k.bottom + 8 && r.bottom > k.top - 8);
        const candidates = gsap.utils.toArray<HTMLElement>(".hf-phrase", el).filter((p) => {
          const r = p.getBoundingClientRect();
          return r.left > bounds.left + 24 && r.right < bounds.right - 24 && !overlaps(r);
        });
        if (!candidates.length) return;
        const words = candidates[Math.floor(Math.random() * candidates.length)].querySelectorAll<HTMLElement>(".hf-w");
        speaking = gsap
          .timeline()
          .to(words, { opacity: 0.9, color: play(), duration: 0.18, ease: "power2.out", stagger: 0.16, overwrite: "auto" })
          .to(words, { color: ink(), duration: 0.3, ease: "power1.out", stagger: 0.16 }, 0.16)
          .to(words, { opacity: 0.08, duration: 0.9, ease: "power2.inOut", clearProps: "color,opacity" }, "+=1.1");
      };
      const loop = gsap.delayedCall(1.6, function repeat() {
        speak();
        loop.restart(true);
      });

      // Save battery: stop everything while the hero is off screen.
      const io = new IntersectionObserver(([entry]) => {
        const on = entry.isIntersecting;
        drifts.forEach((t) => (on ? t.resume() : t.pause()));
        if (on) loop.resume();
        else loop.pause();
        speaking?.paused(!on);
      });
      io.observe(el);

      return () => {
        window.removeEventListener("pointermove", onMove);
        io.disconnect();
      };
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <div className="hf" ref={root} aria-hidden="true">
      {Array.from({ length: ROWS }, (_, r) => {
        const phrases = rowPhrases(r);
        return (
          <div className="hf-row" key={r}>
            <div className="hf-track">
              {[0, 1].map((copy) =>
                phrases.map((p, i) => (
                  <span className="hf-phrase" key={`${copy}-${i}`}>
                    {p.split(" ").map((w, j) => (
                      <span className="hf-w" key={j}>
                        {w}
                      </span>
                    ))}
                  </span>
                )),
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
