import { describe, expect, it } from "vitest";
import { createSilenceMachine, currentHint, SILENCE_MS, type SilenceClock } from "./silence";

function fakeClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const clock: SilenceClock = {
    setTimeout(fn, ms) {
      const id = nextId++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout(h) {
      timers.delete(h as number);
    },
  };
  return {
    clock,
    advance(ms: number) {
      const target = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = target;
    },
    pending: () => timers.size,
  };
}

function setup() {
  const fc = fakeClock();
  let nudges = 0;
  const m = createSilenceMachine({ onNudge: () => void (nudges += 1), clock: fc.clock });
  return { fc, m, nudges: () => nudges };
}

describe("silence machine", () => {
  it("does nothing before the character has finished", () => {
    const { fc, m, nudges } = setup();
    fc.advance(60_000);
    expect(nudges()).toBe(0);
    expect(m.state).toBe("waiting-for-character");
  });

  it("nudges once after 20 seconds of quiet", () => {
    const { fc, m, nudges } = setup();
    m.characterFinished();
    fc.advance(SILENCE_MS - 1);
    expect(nudges()).toBe(0);
    fc.advance(1);
    expect(nudges()).toBe(1);
    expect(m.state).toBe("nudged");
  });

  it("stays quiet after a nudge, even when the nudge line finishes", () => {
    const { fc, m, nudges } = setup();
    m.characterFinished();
    fc.advance(SILENCE_MS);
    m.characterFinished();
    fc.advance(120_000);
    expect(nudges()).toBe(1);
    expect(fc.pending()).toBe(0);
  });

  it("starts a new stretch once the learner sent a line", () => {
    const { fc, m, nudges } = setup();
    m.characterFinished();
    fc.advance(SILENCE_MS);
    m.learnerSent();
    m.characterFinished();
    fc.advance(SILENCE_MS);
    expect(nudges()).toBe(2);
  });

  it("stops waiting when the learner starts speaking or typing", () => {
    const { fc, m, nudges } = setup();
    m.characterFinished();
    fc.advance(10_000);
    m.activity();
    fc.advance(60_000);
    expect(nudges()).toBe(0);
    expect(m.state).toBe("learner-busy");
  });

  it("waits a full 20 seconds again when the learner stops without sending", () => {
    const { fc, m, nudges } = setup();
    m.characterFinished();
    m.activity();
    fc.advance(5_000);
    m.idle();
    fc.advance(SILENCE_MS - 1);
    expect(nudges()).toBe(0);
    fc.advance(1);
    expect(nudges()).toBe(1);
  });

  it("does not arm while the learner is busy when the character finishes", () => {
    const { fc, m, nudges } = setup();
    m.activity();
    m.characterFinished();
    fc.advance(60_000);
    expect(nudges()).toBe(0);
    m.idle();
    fc.advance(SILENCE_MS);
    expect(nudges()).toBe(1);
  });

  it("never fires after the conversation ended", () => {
    const { fc, m, nudges } = setup();
    m.characterFinished();
    m.end();
    fc.advance(60_000);
    m.characterFinished();
    m.idle();
    fc.advance(60_000);
    expect(nudges()).toBe(0);
    expect(m.state).toBe("ended");
  });
});

describe("currentHint", () => {
  const steps = [
    { id: "greet", hint: "Say good morning." },
    { id: "order", hint: "Ask for a coffee and a pastel de nata." },
  ];
  it("gives the hint of the first step that is not done", () => {
    expect(currentHint(steps, [])).toBe("Hint: Say good morning.");
    expect(currentHint(steps, ["greet"])).toBe("Hint: Ask for a coffee and a pastel de nata.");
  });
  it("gives nothing when every step is done", () => {
    expect(currentHint(steps, ["greet", "order"])).toBeNull();
  });
});
