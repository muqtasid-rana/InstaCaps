"use client";

import { useEffect, useRef, useState } from "react";
import { exportCaptionedVideo, type ExportQuality } from "@/lib/export";
import type { SpeechMap } from "@/lib/speech";
import { download, toSRT, toTXT, toVTT } from "@/lib/subtitles";
import type { CaptionStyle, Segment } from "@/lib/types";

interface Props {
  video: Blob;
  name: string;
  segments: Segment[];
  style: CaptionStyle;
  speech: SpeechMap | null;
  onBusy: (busy: boolean) => void;
  onError: (msg: string) => void;
}

export default function ExportPanel({ video, name, segments, style, speech, onBusy, onError }: Props) {
  const [quality, setQuality] = useState<ExportQuality>("high");
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function run() {
    const ac = new AbortController();
    abortRef.current = ac;
    onError("");
    setStatus("");
    setProgress(0);
    onBusy(true);
    const t0 = performance.now();
    try {
      const { blob, ext, method } = await exportCaptionedVideo({
        file: video,
        segments,
        style,
        speech,
        quality,
        onProgress: setProgress,
        signal: ac.signal,
      });
      download(blob, `${name}-captioned.${ext}`);
      setStatus(`Done in ${((performance.now() - t0) / 1000).toFixed(1)} s · ${(blob.size / 1e6).toFixed(1)} MB · ${method}`);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) onError(e instanceof Error ? e.message : String(e));
    } finally {
      abortRef.current = null;
      setProgress(null);
      onBusy(false);
    }
  }

  const empty = !segments.length;

  return (
    <div className="export">
      <section className="panel-section">
        <h4>Video with captions</h4>
        <p className="muted small-text">
          Rendered frame by frame at your video&apos;s original resolution and frame rate, usually faster than real time.
          The original audio is copied untouched.
        </p>
        <div className="row">
          <span className="muted">Quality</span>
          <div className="seg-toggle">
            <button className={quality === "high" ? "on" : ""} onClick={() => setQuality("high")}>
              High
            </button>
            <button className={quality === "max" ? "on" : ""} onClick={() => setQuality("max")}>
              Max (bigger file)
            </button>
          </div>
        </div>
        <div className="row">
          {progress === null ? (
            <button className="primary wide" disabled={empty} onClick={run}>
              ⬇ Export MP4
            </button>
          ) : (
            <>
              <div className="progress">
                <div style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <span className="muted">{Math.round(progress * 100)}%</span>
              <button className="small danger" onClick={() => abortRef.current?.abort()}>
                Cancel
              </button>
            </>
          )}
        </div>
        {status && <p className="notice">{status}</p>}
      </section>

      <section className="panel-section">
        <h4>Subtitle files</h4>
        <p className="muted small-text">
          For Premiere, CapCut, DaVinci Resolve or YouTube. These are plain text, so styles and animation aren&apos;t
          included.
        </p>
        <div className="row">
          <button disabled={empty} onClick={() => download(toSRT(segments), `${name}.srt`)}>
            SRT
          </button>
          <button disabled={empty} onClick={() => download(toVTT(segments), `${name}.vtt`)}>
            VTT
          </button>
          <button disabled={empty} onClick={() => download(toTXT(segments), `${name}.txt`)}>
            Plain text
          </button>
        </div>
      </section>
    </div>
  );
}
