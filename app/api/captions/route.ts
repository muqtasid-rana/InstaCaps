import { GoogleGenAI } from "@google/genai";
import type { ChunkMode, Lang } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60; // within every Vercel plan's limit; a 100 s clip takes Gemini ~10–20 s

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
// Vercel rejects request bodies over 4.5 MB. The browser sends 16 kHz mono WAV (~3.2 MB for 100 s).
const MAX_BYTES = 4.4 * 1024 * 1024;

const schema = {
  type: "object",
  properties: {
    segments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          start: { type: "number", description: "Start time in seconds, e.g. 65.3" },
          end: { type: "number", description: "End time in seconds" },
          text: { type: "string" },
          lang: { type: "string", enum: ["en", "ur", "mixed"] },
        },
        required: ["start", "end", "text", "lang"],
      },
    },
  },
  required: ["segments"],
};

function buildPrompt(duration: number, chunk: ChunkMode) {
  const chunkRule =
    chunk === "short"
      ? "Keep each caption very short and punchy, like Instagram Reels / TikTok captions: 1 to 3 words, NEVER more than 3, at most ~1.2 seconds."
      : "Each caption should be 4 to 5 words, NEVER more than 5, at most ~2.5 seconds. Avoid 1–2 word captions unless the phrase stands alone.";

  return `You are a professional subtitle writer for Pakistani content creators.
Transcribe ALL speech in this audio (total length ${duration.toFixed(1)} seconds) into timed captions.
The speaker switches freely between Urdu and English, often mid-sentence.

Script rules (most important):
- English words and sentences: write them in normal English spelling.
- Urdu speech: write it in Roman Urdu (Latin alphabet) the way Pakistanis type on WhatsApp,
  e.g. "kya haal hai", "main theek hoon", "bohat acha", "nahi yaar", "hum log", "kyun ke".
- NEVER output Urdu/Arabic script or Devanagari. Everything must be in Latin letters.
- Do NOT translate. Write every word in the language it was spoken. Mixed sentences stay mixed,
  e.g. "Aaj hum baat karenge about productivity".

Timing rules:
- ${chunkRule}
- Split at natural pauses and phrase boundaries.
- start and end are in seconds from the start of the audio as decimal numbers (65.3 means 1 minute 5.3 seconds).
- Segments must be in order, must not overlap, and must stay within 0 and ${duration.toFixed(1)}.
- Be precise to about 0.1 s: start is the instant the first syllable of the caption is heard (never after it),
  end is when its last word finishes.

Other rules:
- Skip silence, music and background noise. No speaker labels, no [music] or [laughs] tags.
- Light, natural punctuation. Keep names and brand names as they are normally written.
- lang is "en" for English-only captions, "ur" for Urdu-only, "mixed" for both.
If there is no speech at all, return an empty segments array.`;
}

interface RawSegment {
  start?: unknown;
  end?: unknown;
  text?: unknown;
  lang?: unknown;
}

function clean(raw: { segments?: RawSegment[] }, duration: number) {
  const langs: Lang[] = ["en", "ur", "mixed"];
  const segs = (Array.isArray(raw?.segments) ? raw.segments : [])
    .map((s) => ({
      start: Number(s.start),
      end: Number(s.end),
      text: String(s.text ?? "").trim(),
      lang: (langs.includes(s.lang as Lang) ? s.lang : "mixed") as Lang,
    }))
    .filter((s) => s.text && Number.isFinite(s.start) && Number.isFinite(s.end))
    .sort((a, b) => a.start - b.start);

  const limit = duration > 0 ? duration : Infinity;
  segs.forEach((s, i) => {
    s.start = Math.min(Math.max(0, s.start), limit);
    s.end = Math.min(Math.max(s.end, s.start + 0.3), limit);
    const next = segs[i + 1];
    if (next && s.end > next.start) s.end = Math.max(next.start, s.start + 0.1);
    s.start = Math.round(s.start * 100) / 100;
    s.end = Math.round(s.end * 100) / 100;
  });
  return segs;
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "GEMINI_API_KEY is not set. Add it to .env.local (or your Vercel project's environment variables) and restart." },
      { status: 500 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const media = form.get("media");
  const duration = Number(form.get("duration")) || 0;
  const chunk: ChunkMode = form.get("chunk") === "short" ? "short" : "normal";

  if (!(media instanceof Blob) || media.size === 0) {
    return Response.json({ error: "No audio received." }, { status: 400 });
  }
  if (media.size > MAX_BYTES) {
    return Response.json({ error: "Audio is too large to process (max ~4 MB)." }, { status: 413 });
  }

  const ai = new GoogleGenAI({ apiKey });
  try {
    const data = Buffer.from(await media.arrayBuffer()).toString("base64");
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [{ inlineData: { mimeType: media.type || "audio/wav", data } }, { text: buildPrompt(duration, chunk) }],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: schema,
      },
    });

    const text = res.text;
    if (!text) return Response.json({ error: "Gemini returned an empty response. Try again." }, { status: 502 });
    return Response.json({ segments: clean(JSON.parse(text), duration), model: MODEL });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[captions] Gemini request failed:", message);
    return Response.json({ error: `Gemini request failed: ${message}` }, { status: 502 });
  }
}
