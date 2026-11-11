"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import type { SetWithHistory } from "@/lib/history";
import { fmtTime } from "@/lib/subtitles";
import { uid, type Segment } from "@/lib/types";
import Icon from "./Icon";

interface Props {
  segments: Segment[];
  activeId: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  setSegments: SetWithHistory<Segment[]>;
  seek: (t: number) => void;
  getTime: () => number;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Scroll only the caption panel (never the page) so the row is visible — keeps the video on screen on phones. */
function revealRow(list: HTMLElement, id: string, smooth: boolean) {
  const row = list.querySelector<HTMLElement>(`[data-id="${id}"]`);
  const panel = list.closest<HTMLElement>(".tab-body");
  if (!row || !panel) return;
  const r = row.getBoundingClientRect();
  const p = panel.getBoundingClientRect();
  if (r.top >= p.top && r.bottom <= p.bottom) return;
  panel.scrollTo({ top: panel.scrollTop + (r.top - p.top) - p.height / 3, behavior: smooth ? "smooth" : "auto" });
}

interface Actions {
  update: (id: string, patch: Partial<Segment>, key?: string) => void;
  remove: (id: string) => void;
  insertAfter: (id: string | null) => void;
  mergeNext: (id: string) => void;
}

export default function CaptionList({ segments, activeId, selectedId, onSelect, setSegments, seek, getTime }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  const actions: Actions = useMemo(
    () => ({
      update: (id, patch, key) => setSegments((l) => l.map((s) => (s.id === id ? { ...s, ...patch } : s)), key),
      remove: (id) => setSegments((l) => l.filter((s) => s.id !== id)),
      insertAfter: (id) =>
        setSegments((l) => {
          const i = id ? l.findIndex((s) => s.id === id) : -1;
          const prev = l[i];
          const next = l[i + 1];
          const start = prev ? prev.end : 0;
          const end = next ? Math.max(start + 0.3, next.start) : start + 1.5;
          const copy = [...l];
          copy.splice(i + 1, 0, { id: uid(), start: r3(start), end: r3(end), text: "", lang: "mixed" });
          return copy;
        }),
      mergeNext: (id) =>
        setSegments((l) => {
          const i = l.findIndex((s) => s.id === id);
          const a = l[i];
          const b = l[i + 1];
          if (!a || !b) return l;
          const merged: Segment = {
            ...a,
            text: `${a.text} ${b.text}`.trim(),
            end: Math.max(a.end, b.end),
            lang: a.lang === b.lang ? a.lang : "mixed",
          };
          return [...l.slice(0, i), merged, ...l.slice(i + 2)];
        }),
    }),
    [setSegments],
  );

  // Keep the playing caption in view, unless the user is typing in the list.
  useEffect(() => {
    const list = listRef.current;
    if (!activeId || !list || list.contains(document.activeElement)) return;
    revealRow(list, activeId, true);
  }, [activeId]);

  // Selecting from the timeline scrolls the list to it.
  useEffect(() => {
    if (selectedId && listRef.current) revealRow(listRef.current, selectedId, false);
  }, [selectedId]);

  if (!segments.length) {
    return (
      <div className="empty">
        <p>No captions yet. Generate them above, or write your own.</p>
        <button className="small" onClick={() => actions.insertAfter(null)}>
          + Add a caption
        </button>
      </div>
    );
  }

  return (
    <div className="caps" ref={listRef}>
      {segments.map((s, i) => (
        <Row
          key={s.id}
          seg={s}
          active={s.id === activeId}
          selected={s.id === selectedId}
          isLast={i === segments.length - 1}
          actions={actions}
          onSelect={onSelect}
          seek={seek}
          getTime={getTime}
        />
      ))}
      <button className="small ghost add-cap" onClick={() => actions.insertAfter(segments[segments.length - 1].id)}>
        <Icon name="plus" size={16} />
        Add caption at the end
      </button>
    </div>
  );
}

interface RowProps {
  seg: Segment;
  active: boolean;
  selected: boolean;
  isLast: boolean;
  actions: Actions;
  onSelect: (id: string | null) => void;
  seek: (t: number) => void;
  getTime: () => number;
}

const Row = memo(function Row({ seg, active, selected, isLast, actions, onSelect, seek, getTime }: RowProps) {
  return (
    <div data-id={seg.id} className={`cap${active ? " active" : ""}${selected ? " selected" : ""}`} onMouseDown={() => onSelect(seg.id)}>
      <div className="cap-main">
        <button className="cap-time" onClick={() => seek(seg.start + 0.001)} aria-label={`Jump to ${fmtTime(seg.start)}`} title="Jump here">
          {fmtTime(seg.start)}
        </button>
        <textarea
          className="cap-text"
          rows={1}
          value={seg.text}
          placeholder="Type caption…"
          aria-label={`Caption at ${fmtTime(seg.start)}`}
          spellCheck={false}
          onChange={(e) => actions.update(seg.id, { text: e.target.value }, `text-${seg.id}`)}
        />
        <div className="cap-actions">
          {!isLast && (
            <button className="icon" aria-label="Merge with next caption" title="Merge with next caption" onClick={() => actions.mergeNext(seg.id)}>
              <Icon name="merge" size={16} />
            </button>
          )}
          <button className="icon" aria-label="Add a caption after this one" title="Add a caption after this one" onClick={() => actions.insertAfter(seg.id)}>
            <Icon name="plus" size={16} />
          </button>
          <button className="icon danger" aria-label="Delete caption" title="Delete (Del)" onClick={() => actions.remove(seg.id)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>
      {selected && (
        <div className="cap-timing">
          <TimeField
            label="In"
            value={seg.start}
            onChange={(v) => actions.update(seg.id, { start: v }, `start-${seg.id}`)}
            onNow={() => actions.update(seg.id, { start: r3(getTime()) })}
          />
          <TimeField
            label="Out"
            value={seg.end}
            onChange={(v) => actions.update(seg.id, { end: v }, `end-${seg.id}`)}
            onNow={() => actions.update(seg.id, { end: r3(getTime()) })}
          />
          <span className="muted">{(seg.end - seg.start).toFixed(2)}s</span>
          <span className={`badge ${seg.lang}`}>{seg.lang === "ur" ? "Urdu" : seg.lang === "en" ? "Eng" : "Mix"}</span>
        </div>
      )}
    </div>
  );
});

function TimeField({ label, value, onChange, onNow }: { label: string; value: number; onChange: (v: number) => void; onNow: () => void }) {
  return (
    <div className="tf">
      <span aria-hidden="true">{label}</span>
      <button className="icon" aria-label={`${label} 50 ms earlier`} title="−50 ms" onClick={() => onChange(r3(Math.max(0, value - 0.05)))}>
        <Icon name="minus" size={16} />
      </button>
      <input
        type="number"
        step={0.01}
        min={0}
        value={value}
        aria-label={`${label} time in seconds`}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(Math.max(0, v));
        }}
      />
      <button className="icon" aria-label={`${label} 50 ms later`} title="+50 ms" onClick={() => onChange(r3(value + 0.05))}>
        <Icon name="plus" size={16} />
      </button>
      <button className="icon" aria-label={`Set ${label} to playhead`} title="Set to playhead" onClick={onNow}>
        <Icon name="playhead" size={16} />
      </button>
    </div>
  );
}
