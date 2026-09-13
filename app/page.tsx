"use client";

import { useEffect, useRef, useState } from "react";
import Editor from "@/components/Editor";
import { getMediaDuration } from "@/lib/audio";
import { deleteProject, getVideo, listProjects, saveProject, saveVideo } from "@/lib/storage";
import { fmtTime } from "@/lib/subtitles";
import { DEFAULT_STYLE, MAX_SECONDS, uid, type Project } from "@/lib/types";

export default function Home() {
  const [active, setActive] = useState<{ project: Project; video: Blob } | null>(null);
  const [recent, setRecent] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const relinkInput = useRef<HTMLInputElement>(null);
  const relinkTarget = useRef<Project | null>(null);

  useEffect(() => {
    if (!active) setRecent(listProjects());
  }, [active]);

  async function handleFile(file: File | undefined, existing?: Project) {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("video/")) {
      setError("Please choose a video file (MP4, MOV, WebM…).");
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
      // Video was evicted or never stored — ask for the file again and keep the captions.
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
    <main className="wrap">
      <div className="brand">
        <h1>
          Captions<span>.</span>
        </h1>
        <span className="muted">Urdu + English speech → Roman Urdu + English captions, powered by Gemini</span>
      </div>

      {error && <div className="error">{error}</div>}

      <label
        className={`drop ${dragOver ? "over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFile(e.dataTransfer.files[0]);
        }}
      >
        <input type="file" accept="video/*" hidden onChange={(e) => void handleFile(e.target.files?.[0])} />
        {loading ? (
          <span>
            <span className="spinner" /> Reading video…
          </span>
        ) : (
          <>
            <div className="big">🎬</div>
            <strong>Drop a video here or click to upload</strong>
            <span className="muted">Up to {MAX_SECONDS} seconds · MP4, MOV, WebM · stays on your computer</span>
          </>
        )}
      </label>

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
        <section className="recent">
          <h3 className="muted" style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Recent projects
          </h3>
          <div className="recent-grid">
            {recent.map((p) => (
              <div key={p.id} className="card recent-item">
                <div className="name" title={p.name}>
                  {p.name}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {fmtTime(p.duration)} · {p.segments.length} captions · {new Date(p.updatedAt).toLocaleString()}
                </div>
                <div className="actions">
                  <button className="primary small" onClick={() => void openProject(p)}>
                    Open
                  </button>
                  <button
                    className="small danger"
                    onClick={() => {
                      if (!confirm(`Delete "${p.name}"?`)) return;
                      deleteProject(p.id);
                      setRecent(listProjects());
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
