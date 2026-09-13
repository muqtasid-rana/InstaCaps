import type { Project } from "./types";

// Project metadata + captions live in localStorage; the video files themselves
// are too big for localStorage, so they go to IndexedDB keyed by project id.

const KEY = "captions.projects.v1";
const MAX_PROJECTS = 30;

export function listProjects(): Project[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveProject(p: Project) {
  const all = [{ ...p, updatedAt: Date.now() }, ...listProjects().filter((x) => x.id !== p.id)];
  for (const old of all.slice(MAX_PROJECTS)) void deleteVideo(old.id).catch(() => {});
  try {
    localStorage.setItem(KEY, JSON.stringify(all.slice(0, MAX_PROJECTS)));
  } catch {
    // quota exceeded / storage blocked — the editor still works, just without persistence
  }
}

export function deleteProject(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(listProjects().filter((x) => x.id !== id)));
  } catch {}
  void deleteVideo(id).catch(() => {});
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("captions", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("videos");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("videos", mode);
    const req = fn(tx.objectStore("videos"));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export const saveVideo = (id: string, blob: Blob) => withStore("readwrite", (s) => s.put(blob, id));
export const getVideo = (id: string) => withStore<Blob | undefined>("readonly", (s) => s.get(id));
export const deleteVideo = (id: string) => withStore("readwrite", (s) => s.delete(id));
