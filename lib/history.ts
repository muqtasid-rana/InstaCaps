import { useCallback, useRef, useState } from "react";

export type Updater<T> = T | ((prev: T) => T);
/** `key` groups rapid edits (typing, dragging) into a single undo step. */
export type SetWithHistory<T> = (u: Updater<T>, key?: string) => void;

const MERGE_WINDOW = 1200;

export function useHistory<T>(initial: T) {
  const [h, setH] = useState({ past: [] as T[], present: initial, future: [] as T[] });
  const last = useRef({ key: "", at: 0 });

  const set: SetWithHistory<T> = useCallback((u, key) => {
    const now = Date.now();
    const merge = !!key && key === last.current.key && now - last.current.at < MERGE_WINDOW;
    last.current = { key: key ?? "", at: now };
    setH((s) => {
      const next = typeof u === "function" ? (u as (p: T) => T)(s.present) : u;
      if (Object.is(next, s.present)) return s;
      return { past: merge ? s.past : [...s.past, s.present].slice(-150), present: next, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    last.current = { key: "", at: 0 };
    setH((s) =>
      s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s,
    );
  }, []);

  const redo = useCallback(() => {
    last.current = { key: "", at: 0 };
    setH((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s));
  }, []);

  return { value: h.present, set, undo, redo, canUndo: h.past.length > 0, canRedo: h.future.length > 0 };
}
