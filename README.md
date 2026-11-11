# Captions — Roman Urdu + English

Upload a video (up to 100 s). Gemini (`gemini-3.5-flash-lite`) listens to the audio and writes timed
captions: English stays English, Urdu is written in Roman Urdu, and code-switched sentences stay mixed.
Then edit, style and export them.

## Setup

```bash
npm install
cp .env.local.example .env.local   # then put your key in GEMINI_API_KEY
npm run dev
```

Open http://localhost:3000. Get a Gemini API key at https://aistudio.google.com/apikey.

## How it works

1. **Audio.** The browser decodes the video's audio once, as 16 kHz mono. It's used to send a small WAV
   to Gemini (~3 MB per 100 s), to detect when the voice is active, and to draw the waveform on the timeline.
2. **Transcription.** `app/api/captions/route.ts` sends the audio to Gemini with a JSON schema and a prompt
   tuned for Pakistani Urdu/English code-switching.
3. **Voice sync** (`lib/speech.ts`). Gemini's timestamps are approximate and often a little late. The app
   measures a constant offset from captions that start after a pause, snaps each caption to the nearest
   voice onset and offset, and spreads word-by-word timing over the time the voice is actually active.
   The same logic runs from the timeline's **Auto-sync** button.
   **Caption length** (`lib/chunking.ts`): Short allows at most 3 words per caption and Normal at most 5.
   The model only roughly follows the prompt, so each stretch of continuous speech is re-split into evenly
   sized captions at the voice-based word timings, preferring breaks after punctuation. Switching the
   setting re-splits existing captions instantly (undoable).
4. **Rendering** (`lib/draw.ts`). The live preview and the export share one renderer. Each word is drawn
   once into a cached sprite (text, outline, shadow and pre-blurred animation steps), so every frame is
   just a few image draws. Word animations start slightly before the word so they land on the beat.
5. **Export** (`lib/export.ts`). This uses [mediabunny](https://mediabunny.dev) with WebCodecs. Every
   source frame is decoded, captions are drawn at that frame's exact timestamp, and the frame is re-encoded
   as H.264 at the original resolution and frame rate, at a bitrate of at least 1.25× the source ("High")
   or 2× ("Max"). The audio is copied without re-encoding. Browsers without WebCodecs fall back to
   real-time recording.
   **SRT / VTT / TXT** exports are also available for Premiere, CapCut, Resolve and YouTube.

## Editor

- A timeline with a waveform. Drag a caption block to move it, drag its edges to trim it (the preview
  shows the edge frame), or click empty space to scrub. Ctrl + scroll zooms.
- Caption list: edit the text inline. On the selected caption you can set In/Out times, nudge by ±50 ms,
  or set them to the playhead. You can also merge with the next caption, insert, or delete.
- Keyboard: Space play/pause · ←/→ seek 0.1 s (Shift: 1 s) · S split at the playhead · Del deletes
  the selected caption · Ctrl+Z / Ctrl+Shift+Z undo/redo.
- Styles: fonts (Inter Tight, a Helvetica look-alike, and others), size, letter spacing, case, drop
  shadow, outline, background box, spoken-word highlight, and word-by-word or whole-caption animation
  (rise + blur, fade or pop).

Projects (captions + style) are saved in `localStorage`, and videos in IndexedDB, so everything stays on
your machine. Accounts only track how many caption generations you've used.

## Config

| Env var          | Default                 | Notes                                                        |
| ---------------- | ----------------------- | ------------------------------------------------------------ |
| `GEMINI_API_KEY` | required                | Server-side only, never sent to the browser                  |
| `GEMINI_MODEL`   | `gemini-3.5-flash-lite` |                                                              |
| `APP_PASSWORD`   | unset (no login)        | When set, the whole site asks for this password (any username). Leave unset once accounts are on |
| `NEXT_PUBLIC_FIREBASE_*` | unset (local mode) | Firebase web app config: API key, auth domain, project ID, app ID |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | unset (local mode) | Service account for the server: verifies logins and counts generations |

## Accounts

Each account gets **2 caption generations** (`FREE_GENERATIONS` in `lib/usage.ts`). The server enforces it:
`/api/captions` verifies the Firebase login token, then takes one generation from `users/{uid}` in Firestore
in a transaction *before* calling Gemini, and gives it back if the transcription fails. To give someone more,
set `generationsLimit` on their `users/{uid}` document. Sign-in is Google or email + password
(`/login`, `/signup`); uploading needs an account.

Without the Firebase variables the app runs in **local mode**: no sign-in and nothing is counted. In production
(`NODE_ENV=production`) the captions route refuses to run without the server credentials, so a deploy can never
spend Gemini quota with no limit.

### Setup

1. **Project.** In the [Firebase console](https://console.firebase.google.com), create a project (or reuse one).
2. **Sign-in methods.** Authentication → Sign-in method: enable **Google** and **Email/Password**.
3. **Domains.** Authentication → Settings → Authorized domains: add `instacaps.vercel.app` (and any custom domain).
   `localhost` is there by default.
4. **Firestore.** Firestore Database → Create database (production mode). Then deploy the rules in this repo:
   `firebase deploy --only firestore:rules --project <project-id>`.
5. **Web config.** Project settings → General → Your apps → add a **Web** app. Copy `apiKey`, `authDomain`,
   `projectId` and `appId` into the `NEXT_PUBLIC_FIREBASE_*` variables.
6. **Server key.** Project settings → Service accounts → **Generate new private key**. From the JSON, copy
   `project_id`, `client_email` and `private_key` into `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and
   `FIREBASE_PRIVATE_KEY` (keep the `
` sequences; wrap it in double quotes in `.env.local`).
7. Add the same variables in Vercel (Settings → Environment Variables), **remove `APP_PASSWORD`**, and redeploy.

## Deploy to Vercel

1. Import the GitHub repo in Vercel. The Next.js preset is detected automatically; no `vercel.json` is needed.
2. Under **Settings → Environment Variables**, add `GEMINI_API_KEY` and the Firebase variables (see **Accounts**).
   The captions route refuses to run in production without the Firebase server credentials.
3. Deploy.

Limits that were designed around: the browser sends Gemini a ~3.2 MB WAV for a 100 s clip, which is under
Vercel's 4.5 MB request limit, and the API route runs well within its 60 s `maxDuration`. Video decoding,
styling and export all run in the browser, so large videos never hit the server.
