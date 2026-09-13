/**
 * The playhead, shared outside React so the timeline, time display and
 * preview can follow it every frame without re-rendering the whole editor.
 */
export class Clock {
  t = 0;
  playing = false;
  private listeners = new Set<(t: number) => void>();

  set(t: number, playing: boolean) {
    if (t === this.t && playing === this.playing) return;
    this.t = t;
    this.playing = playing;
    this.listeners.forEach((l) => l(t));
  }

  subscribe(fn: (t: number) => void) {
    this.listeners.add(fn);
    fn(this.t);
    return () => {
      this.listeners.delete(fn);
    };
  }
}
