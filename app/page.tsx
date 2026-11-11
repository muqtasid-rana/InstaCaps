"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import AccountMenu from "@/components/AccountMenu";
import Editor from "@/components/Editor";
import HeroField from "@/components/HeroField";
import HeroTimeline from "@/components/HeroTimeline";
import SignInPrompt from "@/components/SignInPrompt";
import Wordmark from "@/components/Wordmark";
import { getMediaDuration } from "@/lib/audio";
import { authMessage, useAuth } from "@/lib/auth";
import { showGoogleOneTap } from "@/lib/google-one-tap";
import { deleteProject, getVideo, listProjects, saveProject, saveVideo } from "@/lib/storage";
import { fmtTime } from "@/lib/subtitles";
import { DEFAULT_STYLE, MAX_SECONDS, uid, type Project } from "@/lib/types";
import { FREE_GENERATIONS } from "@/lib/usage";

export default function Home() {
  const { configured, ready, user } = useAuth();
  const [active, setActive] = useState<{ project: Project; video: Blob } | null>(null);
  const [recent, setRecent] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const relinkInput = useRef<HTMLInputElement>(null);
  const relinkTarget = useRef<Project | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptFocus, setPromptFocus] = useState(false);

  // With accounts switched on, uploading needs a signed-in account (generations are counted per
  // account). Without Firebase keys the app runs in local mode and nothing is gated.
  const needsSignIn = configured && !user;

  // Every time the site opens for a signed-out visitor, Google's own sign-in prompt appears (top
  // right in Chrome, with their Google account). If Google can't show it, our card slides in from
  // the top right instead. Closing either hides it for this visit only.
  const promptDismissed = useRef(false);
  useEffect(() => {
    if (!ready || user) {
      setPromptOpen(false);
      return;
    }
    if (promptDismissed.current) return;
    let closeGoogle = () => {};
    const t = setTimeout(() => {
      if (!configured) {
        setPromptFocus(false);
        setPromptOpen(true);
        return;
      }
      closeGoogle = showGoogleOneTap({
        onUnavailable: () => {
          if (promptDismissed.current) return;
          setPromptFocus(false);
          setPromptOpen(true);
        },
        onError: (e) => setError(authMessage(e)),
      });
    }, 600);
    return () => {
      clearTimeout(t);
      closeGoogle();
    };
  }, [ready, user, configured]);

  const closePrompt = useCallback(() => {
    promptDismissed.current = true;
    setPromptOpen(false);
  }, []);

  function askToSignIn() {
    setPromptFocus(true);
    setPromptOpen(true);
  }

  // The headline intro plays once per visit, not every time you come back from the editor.
  const [quietIntro, setQuietIntro] = useState(false);

  useEffect(() => {
    if (active) setQuietIntro(true);
    else setRecent(listProjects());
  }, [active]);

  async function handleFile(file: File | undefined, existing?: Project) {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("video/")) {
      setError("Choose a video file (MP4, MOV or WebM).");
      return;
    }
    setLoading(true);
    try {
      const duration = await getMediaDuration(file);
      if (duration > MAX_SECONDS + 0.5) {
        throw new Error(`That video is ${Math.round(duration)} s long. The limit is ${MAX_SECONDS} s, so trim it first.`);
      }
      const now = Date.now();
      const project: Project = existing ?? {
        id: uid(),
        name: file.name,
        createdAt: now,
        updatedAt: now,
        duration,
        segments: [],
        style: DEFAULT_STYLE,
        chunkMode: "short",
      };
      saveProject(project);
      await saveVideo(project.id, file).catch(() => {}); // storage full: still editable this session
      setActive({ project, video: file });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function openProject(p: Project) {
    setError("");
    const video = await getVideo(p.id).catch(() => undefined);
    if (video) {
      setActive({ project: p, video });
    } else {
      // Video was evicted or never stored: ask for the file again and keep the captions.
      relinkTarget.current = p;
      relinkInput.current?.click();
    }
  }

  if (active) {
    return (
      <main>
        <Editor key={active.project.id} project={active.project} video={active.video} onChange={saveProject} onClose={() => setActive(null)} />
      </main>
    );
  }

  return (
    <main
      className={`site home ${dragOver ? "dragging" : ""} ${quietIntro ? "quiet" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (needsSignIn) askToSignIn();
        else void handleFile(e.dataTransfer.files[0]);
      }}
    >
      <header className="home-bar">
        <Wordmark />
        {/* Hidden while the prompt covers this corner, so focus never lands on a covered control. */}
        <nav className="home-nav" aria-label="Account" hidden={promptOpen}>
          {user ? (
            <AccountMenu />
          ) : (
            <>
              <Link href="/login" className="nav-link">
                Log in
              </Link>
              <Link href="/signup" className="nav-pill">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Early in the DOM so keyboard users reach it right after the header. */}
      <SignInPrompt open={promptOpen} takeFocus={promptFocus} returnFocusTo={uploadInput} onClose={closePrompt} />

      <section className="hero">
        <div className="hero-main">
        <HeroField />
        <h1 aria-label={HEADLINE.join(" ")}>
          {HEADLINE.map((w, i) => (
            <span key={i} className="hw" style={{ "--i": i } as React.CSSProperties} aria-hidden="true">
              {w}{" "}
            </span>
          ))}
        </h1>
        <p className="lede">Talk in Urdu, English or both. InstaCaps writes your captions in Roman Urdu and English, timed to your voice.</p>

        <label
          className={`upload ${loading ? "busy" : ""}`}
          onClick={(e) => {
            if (!needsSignIn) return;
            e.preventDefault(); // no file picker until there's an account to count generations on
            askToSignIn();
          }}
        >
          <input
            ref={uploadInput}
            type="file"
            accept="video/*"
            className="visually-hidden"
            disabled={loading}
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <span className="upload-disc" aria-hidden="true">
            {loading ? (
              <span className="spinner" />
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M12 16V5M7 10l5-5 5 5M5 19h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          {loading ? "Reading video…" : "Upload video"}
        </label>
        <p className="meta">
          {needsSignIn ? `${FREE_GENERATIONS} free generations with an account` : `Up to ${MAX_SECONDS} seconds · MP4, MOV or WebM`}
          <span className="drop-hint"> · or drop it anywhere</span>
        </p>

        {error && (
          <p className="home-error" role="alert">
            {error}
          </p>
        )}
        </div>

        <HeroTimeline />
      </section>

      <input
        ref={relinkInput}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => {
          const target = relinkTarget.current;
          relinkTarget.current = null;
          void handleFile(e.target.files?.[0], target ?? undefined);
          e.target.value = "";
        }}
      />

      {recent.length > 0 && (
        <section className="recents" aria-labelledby="recents-title">
          <h2 id="recents-title">Recent</h2>
          <ul>
            {recent.map((p) => (
              <li key={p.id} className="recent-row">
                <button className="recent-open" onClick={() => void openProject(p)}>
                  <span className="recent-name">{p.name}</span>
                  <span className="recent-meta">
                    {fmtTime(p.duration)} · {p.segments.length} {p.segments.length === 1 ? "caption" : "captions"} · {timeAgo(p.updatedAt)}
                  </span>
                </button>
                <button
                  className="recent-delete"
                  aria-label={`Delete ${p.name}`}
                  onClick={() => {
                    if (!confirm(`Delete "${p.name}"?`)) return;
                    deleteProject(p.id);
                    setRecent(listProjects());
                  }}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="steps" aria-labelledby="steps-title">
        <h2 id="steps-title">How it works</h2>
        <ol>
          <li>
            <span className="step-n">01</span>
            <h3>Upload a clip</h3>
            <p>Up to {MAX_SECONDS} seconds, straight from your phone or laptop. MP4, MOV or WebM.</p>
          </li>
          <li>
            <span className="step-n">02</span>
            <h3>Get captions timed to your voice</h3>
            <p>Urdu comes out in Roman Urdu, English stays English, and every word lands when you say it.</p>
          </li>
          <li>
            <span className="step-n">03</span>
            <h3>Style it and export</h3>
            <p>Pick a look, then save a full-quality MP4, or an SRT for Premiere, CapCut and Resolve.</p>
          </li>
        </ol>
      </section>

      <footer className="home-foot">
        <span>© {new Date().getFullYear()} InstaCaps</span>
        <span>Editing and export happen in your browser.</span>
      </footer>

      <div className="drop-veil" aria-hidden="true">
        <span>Drop to start captioning</span>
      </div>
    </main>
  );
}

const HEADLINE = ["Captions", "that", "land", "on", "every", "word"];

function timeAgo(t: number) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
