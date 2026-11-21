// The 20 second silence prompt as a small state machine (docs/spec.md section 6, Scene states).
// It arms when the character has finished and the learner has not started. It fires once per quiet
// stretch: after a nudge it stays quiet until the learner sends a line. Pure: the clock is injected.
export interface SilenceClock {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const SILENCE_MS = 20_000;

export interface SilenceMachine {
  /** The character finished speaking. Starts the wait unless the learner is busy or was nudged. */
  characterFinished(): void;
  /** The learner started speaking or typing. Stops the wait. */
  activity(): void;
  /** The learner stopped without sending. Starts the wait again. */
  idle(): void;
  /** The learner sent a line. A new quiet stretch can begin after the next character line. */
  learnerSent(): void;
  /** The conversation ended. */
  end(): void;
  readonly state: "waiting-for-character" | "armed" | "learner-busy" | "nudged" | "ended";
}

export function createSilenceMachine(opts: {
  onNudge: () => void;
  clock?: SilenceClock;
  delayMs?: number;
}): SilenceMachine {
  const clock: SilenceClock = opts.clock ?? {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  };
  const delay = opts.delayMs ?? SILENCE_MS;
  let state: SilenceMachine["state"] = "waiting-for-character";
  let handle: unknown;
  let characterDone = false;
  let nudgedThisStretch = false;

  function disarm(): void {
    if (handle !== undefined) clock.clearTimeout(handle);
    handle = undefined;
  }
  function arm(): void {
    disarm();
    state = "armed";
    handle = clock.setTimeout(() => {
      handle = undefined;
      if (state !== "armed") return;
      nudgedThisStretch = true;
      state = "nudged";
      opts.onNudge();
    }, delay);
  }

  return {
    characterFinished() {
      if (state === "ended") return;
      characterDone = true;
      if (nudgedThisStretch) {
        state = "nudged";
        return;
      }
      if (state === "learner-busy") return;
      arm();
    },
    activity() {
      if (state === "ended") return;
      disarm();
      state = "learner-busy";
    },
    idle() {
      if (state === "ended" || state !== "learner-busy") return;
      if (characterDone && !nudgedThisStretch) arm();
      else state = nudgedThisStretch ? "nudged" : "waiting-for-character";
    },
    learnerSent() {
      if (state === "ended") return;
      disarm();
      characterDone = false;
      nudgedThisStretch = false;
      state = "waiting-for-character";
    },
    end() {
      disarm();
      state = "ended";
    },
    get state() {
      return state;
    },
  };
}

/** The hint under a silence prompt: the hint of the first goal step that is not done. */
export function currentHint(steps: readonly { id: string; hint: string }[], done: readonly string[]): string | null {
  const next = steps.find((s) => !done.includes(s.id));
  return next ? `Hint: ${next.hint}` : null;
}
