"use client";

import { useEffect, useRef, useState } from "react";
import { describeError, exportCaptionedVideo, type ExportQuality } from "@/lib/export";
import type { SpeechMap } from "@/lib/speech";
import { download, saveUrl, toSRT, toTXT, toVTT } from "@/lib/subtitles";
import type { CaptionStyle, Segment } from "@/lib/types";
import Icon from "./Icon";

interface Props {
  video: Blob;
  name: string;
  segments: Segment[];
  style: CaptionStyle;
  speech: SpeechMap | null;
  onBusy: (busy: boolean) => void;
  onError: (msg: string) => void;
}

interface Result {
  url: string;
  blob: Blob;
  filename: string;
  info: string;
}

export default function ExportPanel({ video, name, segments, style, speech, onBusy, onError }: Props) {
  const [quality, setQuality] = useState<ExportQuality>("high");
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [canShare, setCanShare] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    try {
      setCanShare(!!navigator.canShare?.({ files: [new File([], "x.mp4", { type: "video/mp4" })] }));
    } catch {
      setCanShare(false);
    }
  }, []);

  // The exported file stays available (for Save / Share) until it's replaced or the editor closes.
  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  // Editing after an export makes that file stale.
  useEffect(() => setResult(null), [segments, style]);

  async function run() {
    const ac = new AbortController();
    abortRef.current = ac;
    onError("");
    setResult(null);
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
      const filename = `${name}-captioned.${ext}`;
      const url = URL.createObjectURL(blob);
      setResult({ url, blob, filename, info: `Done in ${((performance.now() - t0) / 1000).toFixed(1)} s · ${method}` });
      // Desktop: download straight away. Phones: use the buttons below — a direct tap is more reliable there.
      if (window.matchMedia("(pointer: fine)").matches) saveUrl(url, filename);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) onError(describeError(e));
    } finally {
      abortRef.current = null;
      setProgress(null);
      onBusy(false);
    }
  }

  async function share() {
    if (!result) return;
    const file = new File([result.blob], result.filename, { type: result.blob.type || "video/mp4" });
    try {
      await navigator.share({ files: [file], title: result.filename });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) onError(`Sharing failed: ${describeError(e)}`);
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
            <button className={quality === "high" ? "on" : ""} aria-pressed={quality === "high"} onClick={() => setQuality("high")}>
              High
            </button>
            <button className={quality === "max" ? "on" : ""} aria-pressed={quality === "max"} onClick={() => setQuality("max")}>
              Max (bigger file)
            </button>
          </div>
        </div>
        <div className="row">
          {progress === null ? (
            <button className={result ? "wide" : "primary wide"} disabled={empty} onClick={run}>
              {result ? (
                "Export again"
              ) : (
                <>
                  <Icon name="download" size={16} />
                  Export MP4
                </>
              )}
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
        {result && progress === null && (
          <div className="export-result">
            <a className="btn primary wide" href={result.url} download={result.filename}>
              <Icon name="download" size={16} />
              Save video · {(result.blob.size / 1e6).toFixed(1)} MB
            </a>
            {canShare && (
              <button className="wide" onClick={share}>
                <Icon name="share" size={16} />
                Share or save to Photos
              </button>
            )}
            <p className="notice">{result.info}</p>
          </div>
        )}
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
