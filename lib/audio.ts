export const SAMPLE_RATE = 16000;

/**
 * Decode the audio track of a video in the browser as 16 kHz mono samples.
 * Used both for Gemini (as a small WAV) and for voice-activity detection.
 */
export async function decodeMono(file: Blob, sampleRate = SAMPLE_RATE): Promise<Float32Array> {
  const data = await file.arrayBuffer();
  const ctx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(data);
  } finally {
    void ctx.close();
  }

  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * sampleRate), sampleRate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination); // mono destination downmixes stereo automatically
  src.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

/** 16-bit PCM WAV. A 100 s clip at 16 kHz is ~3.2 MB, small enough to send to Gemini inline. */
export function encodeWav(samples: Float32Array, sampleRate = SAMPLE_RATE): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export function getMediaDuration(file: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    const done = () => {
      URL.revokeObjectURL(url);
      resolve(v.duration);
    };
    v.onloadedmetadata = () => {
      if (Number.isFinite(v.duration)) return done();
      // Some WebM files (e.g. screen recordings) don't store a duration; seeking far forces the browser to compute it.
      v.ontimeupdate = () => {
        v.ontimeupdate = null;
        done();
      };
      v.currentTime = 1e101;
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This browser can't read that video file."));
    };
    v.src = url;
  });
}
