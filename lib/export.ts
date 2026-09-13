import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  canEncodeVideo,
  Conversion,
  ConversionCanceledError,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
} from "mediabunny";
import { loadCaptionFont, renderCaptions } from "./draw";
import type { SpeechMap } from "./speech";
import type { CaptionStyle, Segment } from "./types";

export type ExportQuality = "high" | "max";

interface ExportOptions {
  file: Blob;
  segments: Segment[];
  style: CaptionStyle;
  speech: SpeechMap | null;
  quality: ExportQuality;
  onProgress: (p: number) => void;
  signal: AbortSignal;
}

interface ExportResult {
  blob: Blob;
  ext: string;
  method: string;
}

const abortError = () => new DOMException("Export cancelled", "AbortError");

/**
 * Burn captions into the video.
 *
 * Main path (WebCodecs via mediabunny): every source frame is decoded, captions
 * are drawn on it at the frame's exact timestamp, and it is re-encoded as H.264
 * at the original resolution and frame rate with a bitrate at or above the
 * source's. Audio is copied as-is. Runs faster than real time and can't drop frames.
 *
 * Fallback (browsers without WebCodecs): real-time playback + MediaRecorder.
 */
export async function exportCaptionedVideo(opts: ExportOptions): Promise<ExportResult> {
  await loadCaptionFont(opts.style);
  const o = { ...opts, file: await ensureReadable(opts.file) };
  const isAbort = (e: unknown) => opts.signal.aborted || (e instanceof DOMException && e.name === "AbortError");

  let firstError: unknown = null;
  if (typeof VideoEncoder !== "undefined" && typeof VideoDecoder !== "undefined") {
    try {
      return await exportWithWebCodecs(o);
    } catch (e) {
      if (isAbort(e)) throw abortError();
      firstError = e;
      console.warn("[export] WebCodecs export failed, falling back to MediaRecorder:", e);
    }
  }
  try {
    return await recordInRealTime(o);
  } catch (e) {
    if (isAbort(e)) throw abortError();
    console.error("[export] fallback failed:", e);
    if (!firstError) throw e;
    throw new Error(`Export failed: ${describeError(firstError)} (fallback: ${describeError(e)})`);
  }
}

export const describeError = (e: unknown) =>
  e instanceof Error ? (e.name && e.name !== "Error" ? `${e.name}: ${e.message}` : e.message) : String(e);

const COPY_LIMIT = 300 * 1024 * 1024;

/**
 * Make sure the original video can still be read, and (up to 300 MB) keep it in memory for the
 * export. Phones can lose access to a file picked a while ago; better to say so up front than fail
 * halfway through with an obscure read error.
 */
async function ensureReadable(file: Blob): Promise<Blob> {
  try {
    if (file.size <= COPY_LIMIT) return new Blob([await file.arrayBuffer()], { type: file.type });
    await file.slice(0, 65536).arrayBuffer();
    await file.slice(Math.max(0, file.size - 65536)).arrayBuffer();
    return file;
  } catch (e) {
    console.error("[export] source video unreadable:", e);
    throw new Error(
      "The browser can no longer read the original video file (phones do this after a while, or if the file was moved). Tap ← Projects, open the video again, then export once more.",
    );
  }
}

async function exportWithWebCodecs({ file, segments, style, speech, quality, onProgress, signal }: ExportOptions): Promise<ExportResult> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new Error("No video track found.");

  // Match or beat the source bitrate so re-encoding doesn't visibly soften the picture.
  const stats = await track.computePacketStats(120);
  const width = track.displayWidth || 1080;
  const height = track.displayHeight || 1920;
  const fps = stats.averagePacketRate || 30;
  const pixelsPerSecond = width * height * fps;
  const bitrate = Math.round(
    Math.min(
      80e6,
      quality === "max"
        ? Math.max(stats.averageBitrate * 2, pixelsPerSecond * 0.35)
        : Math.max(stats.averageBitrate * 1.25, pixelsPerSecond * 0.15),
    ),
  );
  const videoQuality = new Quality({ bitrate }); // a bare number would mean a 0–1 quality level, not bits/s
  const avcOk = await canEncodeVideo("avc", { width, height, quality: videoQuality }).catch(() => false);

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });

  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;

  const conversion = await Conversion.init({
    input,
    output,
    video: {
      forceTranscode: true,
      allowRotationMetadata: false, // bake phone rotation into the frames, since we draw upright captions on them
      codec: avcOk ? "avc" : undefined,
      quality: videoQuality,
      process: (sample) => {
        const W = sample.displayWidth;
        const H = sample.displayHeight;
        if (!canvas || canvas.width !== W || canvas.height !== H) {
          canvas = document.createElement("canvas");
          canvas.width = W;
          canvas.height = H;
          ctx = canvas.getContext("2d")!;
        }
        sample.draw(ctx!, 0, 0, W, H);
        renderCaptions(ctx!, segments, sample.timestamp, style, W, H, speech);
        return canvas;
      },
    },
    // audio: omitted → copied without re-encoding whenever the codec fits in MP4
  });

  if (!conversion.isValid || !conversion.utilizedTracks.some((t) => t.isVideoTrack())) {
    throw new Error(`Can't convert this file: ${conversion.discardedTracks.map((d) => d.reason).join(", ")}`);
  }

  conversion.onProgress = onProgress;
  const onAbort = () => void conversion.cancel();
  signal.addEventListener("abort", onAbort);
  try {
    await conversion.execute();
  } catch (e) {
    if (e instanceof ConversionCanceledError) throw abortError();
    throw e;
  } finally {
    signal.removeEventListener("abort", onAbort);
  }

  const buffer = output.target.buffer;
  if (!buffer) throw new Error("Export produced no data.");
  onProgress(1);
  return {
    blob: new Blob([buffer], { type: "video/mp4" }),
    ext: "mp4",
    method: `${avcOk ? "H.264" : "MP4"} ${width}×${height} @ ${(bitrate / 1e6).toFixed(0)} Mbps`,
  };
}

const RECORDER_MIME = [
  "video/mp4;codecs=avc1.640028,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

/** Real-time fallback: plays the video into a canvas and records it. The tab must stay visible. */
async function recordInRealTime({ file, segments, style, speech, quality, onProgress, signal }: ExportOptions): Promise<ExportResult> {
  const src = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.playsInline = true;
  video.src = src;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("Could not load the video for export."));
    });

    const W = video.videoWidth;
    const H = video.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    // captureStream(0) + requestFrame(): exactly one recorded frame per source frame.
    const stream = canvas.captureStream(0);
    const videoTrack = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
    const audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();
    audioCtx.createMediaElementSource(video).connect(dest);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

    const mimeType = RECORDER_MIME.find((m) => MediaRecorder.isTypeSupported(m));
    if (!mimeType) throw new Error("This browser can't export video. Try Chrome or Edge.");
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: quality === "max" ? 25e6 : 12e6,
      audioBitsPerSecond: 192e3,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));

    let running = true;
    const render = (_now?: number, meta?: VideoFrameCallbackMetadata) => {
      const t = meta?.mediaTime ?? video.currentTime;
      ctx.drawImage(video, 0, 0, W, H);
      renderCaptions(ctx, segments, t, style, W, H, speech);
      videoTrack.requestFrame();
      onProgress(video.duration ? t / video.duration : 0);
      if (running) schedule();
    };
    const schedule = () =>
      "requestVideoFrameCallback" in video ? video.requestVideoFrameCallback(render) : requestAnimationFrame(() => render());

    const stop = () => {
      running = false;
      video.pause();
      if (recorder.state !== "inactive") recorder.stop();
    };
    signal.addEventListener("abort", stop);
    video.onended = stop;
    try {
      recorder.start(500);
      render();
      await audioCtx.resume();
      await video.play();
      await stopped;
    } finally {
      signal.removeEventListener("abort", stop);
      void audioCtx.close();
    }

    if (signal.aborted) throw abortError();
    onProgress(1);
    const ext = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
    return { blob: new Blob(chunks, { type: mimeType.split(";")[0] }), ext, method: "real-time recording (fallback)" };
  } finally {
    URL.revokeObjectURL(src);
  }
}
