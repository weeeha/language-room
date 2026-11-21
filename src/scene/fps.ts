// Frame-rate meter for the scene viewer. Pure: the clock is injected.
// It counts frames drawn while the render loop is running, over the time the loop was running.
// Frames drawn while the loop is paused (on demand, after a Spark sort or a drag) are counted apart,
// so a paused scene never reports a rate of 0.

export type FpsReport =
  | { kind: "continuous"; fps: number; seconds: number }
  | { kind: "on-demand"; frames: number; seconds: number };

export interface FpsMeter {
  /** A frame was drawn. */
  frame(): void;
  /** The render loop started or stopped producing frames (paused header, hidden tab). */
  setActive(active: boolean): void;
  /** Checks the window. Returns a report once, then null. */
  sample(): FpsReport | null;
}

export function createFpsMeter(opts: { now: () => number; windowMs: number; giveUpAfterMs?: number }): FpsMeter {
  const startedAt = opts.now();
  const giveUpAfter = opts.giveUpAfterMs ?? opts.windowMs * 3;
  let active = false;
  let activeSince = 0;
  let activeMs = 0;
  let activeFrames = 0;
  let onDemandFrames = 0;
  let reported = false;

  const activeTotal = (): number => activeMs + (active ? opts.now() - activeSince : 0);

  return {
    frame() {
      if (active) activeFrames += 1;
      else onDemandFrames += 1;
    },
    setActive(next) {
      if (next === active) return;
      const t = opts.now();
      if (active) activeMs += t - activeSince;
      else activeSince = t;
      active = next;
    },
    sample() {
      if (reported) return null;
      const running = activeTotal();
      if (running >= opts.windowMs) {
        reported = true;
        return { kind: "continuous", fps: Math.round((activeFrames / running) * 1000), seconds: Math.round(running / 1000) };
      }
      const wall = opts.now() - startedAt;
      if (wall >= giveUpAfter) {
        reported = true;
        return { kind: "on-demand", frames: activeFrames + onDemandFrames, seconds: Math.round(wall / 1000) };
      }
      return null;
    },
  };
}
