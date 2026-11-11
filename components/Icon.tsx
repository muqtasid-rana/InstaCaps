// One line-icon set for the whole app (paths follow Lucide, 24px grid). Icons are decorative:
// the button that holds one carries the accessible name.

const PATHS = {
  back: ["m15 18-6-6 6-6"],
  prev: ["m15 18-6-6 6-6"],
  next: ["m9 18 6-6-6-6"],
  undo: ["M9 14 4 9l5-5", "M4 9h10.5a5.5 5.5 0 0 1 0 11H11"],
  redo: ["m15 14 5-5-5-5", "M20 9H9.5a5.5 5.5 0 0 0 0 11H13"],
  start: ["M19 20 9 12l10-8v16z", "M5 19V5"],
  volume: ["M11 5 6 9H2v6h4l5 4V5z", "M15.54 8.46a5 5 0 0 1 0 7.07", "M19.07 4.93a10 10 0 0 1 0 14.14"],
  mute: ["M11 5 6 9H2v6h4l5 4V5z", "m22 9-6 6", "m16 9 6 6"],
  split: ["M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", "M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", "M20 4 8.12 15.88", "M14.47 14.48 20 20", "M8.12 8.12 12 12"],
  sync: ["M2 10v3", "M6 6v11", "M10 3v18", "M14 8v7", "M18 5v13", "M22 10v3"],
  captions: ["M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z", "M7 15h4", "M15 15h2", "M7 11h2", "M13 11h4"],
  merge: ["M12 17V3", "m6 11 6 6 6-6", "M19 21H5"],
  plus: ["M5 12h14", "M12 5v14"],
  minus: ["M5 12h14"],
  close: ["M18 6 6 18", "m6 6 12 12"],
  playhead: ["M12 2v20", "M8 2h8l-4 5z"],
  download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "m7 10 5 5 5-5", "M12 15V3"],
  share: ["M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8", "m16 6-4-4-4 4", "M12 2v13"],
} as const;

export type IconName = keyof typeof PATHS | "play" | "pause";

export default function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  if (name === "play" || name === "pause") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="currentColor">
        {name === "play" ? <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" /> : <path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" />}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
