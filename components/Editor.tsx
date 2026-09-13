"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CaptionList from "./CaptionList";
import ExportPanel from "./ExportPanel";
import PlayerControls from "./PlayerControls";
import StylePanel from "./StylePanel";
import Timeline from "./Timeline";
import { decodeMono, encodeWav, SAMPLE_RATE } from "@/lib/audio";
import { MAX_WORDS, rechunk } from "@/lib/chunking";
import { Clock } from "@/lib/clock";
import { fontSpec, renderCaptions, splitWords, wordTimes } from "@/lib/draw";
import { useHistory } from "@/lib/history";
import { alignSegments, analyzeSpeech, type SpeechMap } from "@/lib/speech";
import { fmtTime } from "@/lib/subtitles";
import { normalizeStyle, uid, type ChunkMode, type Project, type Segment } from "@/lib/types";

const MAX_UPLOAD = 4 * 1024 * 1024; // hosting request limit (Vercel: 4.5 MB) for the raw-video fallback
const r3 = (x: number) => Math.round(x * 1000) / 1000;

type Tab = "captions" | "style" | "export";
const TABS: [Tab, string][] = [
  ["captions", "Captions"],
  ["style", "Style"],
  ["export", "Export"],
];

interface Props {
  project: Project;
  video: Blob;
  onChange: (p: Project) => void;
  onClose: () => void;
}

export default function Editor({ project, video, onChange, onClose }: Props) {
  const history = useHistory<Segment[]>(project.segments);
  const { value: segments, set: setSegments, undo, redo } = history;
  const [style, setStyle] = useState(() => normalizeStyle(project.style));
  const [chunkMode, setChunkMode] = useState<ChunkMode>(project.chunkMode ?? "short");
  const [tab, setTab] = useState<Tab>("captions");
  const [src, setSrc] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [speech, setSpeech] = useState<SpeechMap | null>(null);
  const [saved, setSaved] = useState(true);
  const [exporting, setExporting] = useState(false);

  const clock = useMemo(() => new Clock(), []);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const samplesRef = useRef<Float32Array | null>(null);
  const dirty = useRef(true);
  const live = useRef({ segments, style, speech });
  live.current = { segments, style, speech };

  const baseName = project.name.replace(/\.[^.]+$/, "");

  useEffect(() => {
    const url = URL.createObjectURL(video);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [video]);

  // Decode the audio once: used for the waveform, voice sync, and sending to Gemini.
  useEffect(() => {
    let alive = true;
    decodeMono(video)
      .then((samples) => {
        if (!alive) return;
        samplesRef.current = samples;
        setSpeech(analyzeSpeech(samples, SAMPLE_RATE));
      })
      .catch(() => {}); // no decodable audio: timeline just has no waveform
    return () => {
      alive = false;
    };
  }, [video]);

  // ---- autosave (debounced, and flushed when leaving the editor) ----
  const latest = useRef({ project, segments, style, chunkMode, onChange });
  latest.current = { project, segments, style, chunkMode, onChange };
  const save = useCallback(() => {
    const l = latest.current;
    l.onChange({ ...l.project, segments: l.segments, style: l.style, chunkMode: l.chunkMode });
    setSaved(true);
  }, []);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setSaved(false);
    const id = setTimeout(save, 500);
    return () => clearTimeout(id);
  }, [segments, style, chunkMode, save]);
  useEffect(() => () => save(), [save]);

  // ---- preview rendering ----
  useEffect(() => {
    dirty.current = true;
  }, [segments, style, speech]);

  useEffect(() => {
    void document.fonts.load(fontSpec(style)).then(() => (dirty.current = true));
  }, [style.font, style.weight]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draw at the canvas's on-screen size (not the video's full resolution) — much cheaper for 4K sources.
  useEffect(() => {
    const c = canvasRef.current!;
    const ro = new ResizeObserver(([entry]) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.max(1, Math.round(entry.contentRect.width * dpr));
      c.height = Math.max(1, Math.round(entry.contentRect.height * dpr));
      dirty.current = true;
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current!;
    let raf = 0;
    let lastT = -1;
    // The exact media time of the frame on screen, from requestVideoFrameCallback, extrapolated
    // between video frames so captions animate at the display's refresh rate and stay in sync.
    let frame: { media: number; at: number } | null = null;
    const onFrame = (_: number, meta: VideoFrameCallbackMetadata) => {
      frame = { media: meta.mediaTime, at: meta.expectedDisplayTime };
      v.requestVideoFrameCallback(onFrame);
    };
    const hasRVFC = "requestVideoFrameCallback" in v;
    if (hasRVFC) v.requestVideoFrameCallback(onFrame);

    const tick = (now: number) => {
      let t = v.currentTime;
      if (!v.paused && frame) {
        const est = frame.media + (Math.max(0, now - frame.at) / 1000) * v.playbackRate;
        if (Math.abs(est - t) < 0.25) t = est;
      }
      clock.set(t, !v.paused);

      const c = canvasRef.current;
      if (c && (t !== lastT || dirty.current)) {
        lastT = t;
        dirty.current = false;
        const ctx = c.getContext("2d")!;
        ctx.clearRect(0, 0, c.width, c.height);
        const L = live.current;
        const seg = renderCaptions(ctx, L.segments, t, L.style, c.width, c.height, L.speech);
        const id = seg?.id ?? null;
        setActiveId((prev) => (prev === id ? prev : id));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clock]);

  // ---- playback helpers ----
  const seek = useCallback(
    (t: number) => {
      const v = videoRef.current;
      if (v) v.currentTime = Math.min(Math.max(0, t), v.duration || project.duration);
    },
    [project.duration],
  );
  const getTime = useCallback(() => videoRef.current?.currentTime ?? 0, []);
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }, []);

  // ---- caption operations ----
  async function generate() {
    if (segments.length && !confirm("Replace the current captions with a fresh transcription?")) return;
    setError("");
    setNotice("");
    try {
      setBusy("Reading audio…");
      const form = new FormData();
      let samples = samplesRef.current;
      if (!samples) {
        samples = await decodeMono(video).catch(() => null);
        samplesRef.current = samples;
      }
      if (samples) {
        form.append("media", encodeWav(samples), "audio.wav");
      } else {
        // Browser couldn't decode the audio track — fall back to sending the video itself.
        if (video.size > MAX_UPLOAD) {
          throw new Error(
            "Your browser couldn't read this video's audio, and the file is too big to send as-is (max 4 MB). Try re-exporting it as MP4 (H.264 + AAC).",
          );
        }
        form.append("media", video, project.name);
      }
      form.append("duration", String(project.duration));
      form.append("chunk", chunkMode);

      setBusy("Gemini is listening…");
      const res = await fetch("/api/captions", { method: "POST", body: form });
      const json = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
      if (!res.ok) throw new Error(json.error || `Server error (${res.status})`);

      let segs: Segment[] = json.segments.map((s: Omit<Segment, "id">) => ({ ...s, id: uid() }));
      const map = speech ?? (samples ? analyzeSpeech(samples, SAMPLE_RATE) : null);
      if (map) {
        if (!speech) setSpeech(map);
        segs = alignSegments(segs, map, project.duration);
      }
      segs = rechunk(segs, chunkMode, map); // the model only roughly follows the word limit, so enforce it
      setSegments(segs);
      setSelectedId(null);
      if (!segs.length) setError("No speech was detected in this video.");
      else setNotice(map ? `${segs.length} captions, synced to your voice.` : `${segs.length} captions.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  // Switching length re-splits the existing captions instantly (no new Gemini call; Ctrl+Z undoes it).
  function changeChunkMode(mode: ChunkMode) {
    if (mode === chunkMode) return;
    setChunkMode(mode);
    if (!segments.length) return;
    setSegments((list) => rechunk(list, mode, speech));
    setSelectedId(null);
    setNotice(`Re-split into captions of up to ${MAX_WORDS[mode]} words. Ctrl+Z to undo.`);
  }

  const autoSync = useCallback(() => {
    if (!speech) return;
    setSegments((list) => alignSegments(list, speech, project.duration));
    setNotice("Caption timings snapped to your voice.");
  }, [speech, project.duration, setSegments]);

  const nudgeAll = useCallback(
    (d: number) =>
      setSegments(
        (list) => list.map((s) => ({ ...s, start: Math.max(0, r3(s.start + d)), end: Math.max(0.05, r3(s.end + d)) })),
        "nudge-all",
      ),
    [setSegments],
  );

  const splitAtPlayhead = useCallback(() => {
    const t = getTime();
    setSegments((list) => {
      const i = list.findIndex((s) => t > s.start + 0.05 && t < s.end - 0.05);
      if (i < 0) return list;
      const s = list[i];
      const words = splitWords(s.text);
      if (words.length < 2) return list;
      const times = wordTimes(s, words, live.current.speech);
      const k = Math.min(words.length - 1, Math.max(1, times.filter((x) => x < t).length));
      const a: Segment = { ...s, text: words.slice(0, k).join(" "), end: r3(t) };
      const b: Segment = { ...s, id: uid(), text: words.slice(k).join(" "), start: r3(t) };
      return [...list.slice(0, i), a, b, ...list.slice(i + 1)];
    });
  }, [getTime, setSegments]);

  // ---- keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = !!el.closest?.("input, textarea, select, [contenteditable]");
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && !typing && (k === "z" || k === "y")) {
        e.preventDefault();
        if (k === "y" || e.shiftKey) redo();
        else undo();
        return;
      }
      if (typing || mod || e.altKey) return;
      const v = videoRef.current;
      if (!v) return;
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const d = (e.shiftKey ? 1 : 0.1) * (e.key === "ArrowLeft" ? -1 : 1);
        seek(v.currentTime + d);
      } else if (k === "s") {
        splitAtPlayhead();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        setSegments((list) => list.filter((s) => s.id !== selectedId));
        setSelectedId(null);
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, togglePlay, seek, splitAtPlayhead, selectedId, setSegments]);

  return (
    <div className="ed">
      <header className="ed-top">
        <button className="ghost" onClick={onClose} disabled={exporting}>
          ← Projects
        </button>
        <div className="ed-title">
          <strong title={project.name}>{project.name}</strong>
          <span className="muted">
            {fmtTime(project.duration)} · {saved ? "Saved" : "Saving…"}
          </span>
        </div>
        <div className="ed-top-actions">
          <button className="icon-btn" onClick={undo} disabled={!history.canUndo} title="Undo (Ctrl+Z)">
            ↶
          </button>
          <button className="icon-btn" onClick={redo} disabled={!history.canRedo} title="Redo (Ctrl+Shift+Z)">
            ↷
          </button>
          <button className="primary" onClick={() => setTab("export")}>
            Export
          </button>
        </div>
      </header>

      {error && (
        <div className="error" onClick={() => setError("")} title="Click to dismiss">
          {error}
        </div>
      )}

      <div className="ed-main">
        <section className="ed-stage">
          <div className="stage">
            <div className="player" onClick={togglePlay}>
              <video ref={videoRef} src={src || undefined} playsInline preload="auto" />
              <canvas ref={canvasRef} />
            </div>
          </div>
          <PlayerControls videoRef={videoRef} clock={clock} duration={project.duration} onToggle={togglePlay} seek={seek} />
        </section>

        <aside className="ed-side">
          <nav className="tabs">
            {TABS.map(([id, label]) => (
              <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </nav>
          <div className="tab-body">
            <div hidden={tab !== "captions"}>
              <div className="transcribe">
                <div className="row">
                  <span className="muted">Caption length</span>
                  <div className="seg-toggle">
                    <button className={chunkMode === "short" ? "on" : ""} onClick={() => changeChunkMode("short")}>
                      Short · 1–3 words
                    </button>
                    <button className={chunkMode === "normal" ? "on" : ""} onClick={() => changeChunkMode("normal")}>
                      Normal · 4–5 words
                    </button>
                  </div>
                </div>
                <button className="primary wide" onClick={generate} disabled={!!busy || exporting}>
                  {busy ? (
                    <>
                      <span className="spinner" />
                      {busy}
                    </>
                  ) : segments.length ? (
                    "✨ Regenerate captions"
                  ) : (
                    "✨ Generate captions"
                  )}
                </button>
                {notice && <p className="notice">{notice}</p>}
              </div>
              <CaptionList
                segments={segments}
                activeId={activeId}
                selectedId={selectedId}
                onSelect={setSelectedId}
                setSegments={setSegments}
                seek={seek}
                getTime={getTime}
              />
            </div>
            <div hidden={tab !== "style"}>
              <StylePanel style={style} setStyle={setStyle} />
            </div>
            <div hidden={tab !== "export"}>
              <ExportPanel
                video={video}
                name={baseName}
                segments={segments}
                style={style}
                speech={speech}
                onBusy={setExporting}
                onError={setError}
              />
            </div>
          </div>
        </aside>
      </div>

      <Timeline
        duration={project.duration}
        segments={segments}
        setSegments={setSegments}
        speech={speech}
        clock={clock}
        seek={seek}
        activeId={activeId}
        selectedId={selectedId}
        onSelect={setSelectedId}
        toolbar={
          <>
            <button className="small" onClick={splitAtPlayhead} title="Split the caption under the playhead (S)">
              ✂ Split
            </button>
            <button className="small" onClick={autoSync} disabled={!speech || !segments.length} title="Snap caption timings to your voice">
              ⚡ Auto-sync
            </button>
            <div className="nudge">
              <span className="muted">Shift all</span>
              <button className="small" onClick={() => nudgeAll(-0.05)} title="Every caption 50 ms earlier">
                −50ms
              </button>
              <button className="small" onClick={() => nudgeAll(0.05)} title="Every caption 50 ms later">
                +50ms
              </button>
            </div>
            <span className="muted kbd-hint">Space play · ←/→ seek · S split · Del delete · Ctrl+Z undo · drag blocks to retime</span>
          </>
        }
      />
    </div>
  );
}
