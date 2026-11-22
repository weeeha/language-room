import { describe, expect, it } from "vitest";
import { createFpsMeter } from "./fps";

function clock() {
  let t = 1000;
  return { now: () => t, tick: (ms: number) => void (t += ms) };
}

describe("fps meter", () => {
  it("reports frames drawn per second over the window", () => {
    const c = clock();
    const m = createFpsMeter({ now: c.now, windowMs: 5000 });
    m.setActive(true);
    for (let i = 0; i < 250; i++) {
      c.tick(20);
      m.frame();
    }
    expect(m.sample()).toEqual({ kind: "continuous", fps: 50, seconds: 5 });
    expect(m.sample()).toBeNull();
  });

  it("waits for a full window of running time", () => {
    const c = clock();
    const m = createFpsMeter({ now: c.now, windowMs: 5000 });
    m.setActive(true);
    for (let i = 0; i < 60; i++) {
      c.tick(50);
      m.frame();
    }
    expect(m.sample()).toBeNull();
    for (let i = 0; i < 40; i++) {
      c.tick(50);
      m.frame();
    }
    expect(m.sample()).toEqual({ kind: "continuous", fps: 20, seconds: 5 });
  });

  it("does not count paused time or on-demand frames in the rate", () => {
    const c = clock();
    const m = createFpsMeter({ now: c.now, windowMs: 5000 });
    m.setActive(true);
    for (let i = 0; i < 60; i++) {
      c.tick(50);
      m.frame();
    }
    m.setActive(false);
    c.tick(20_000);
    m.frame();
    m.frame();
    m.setActive(true);
    for (let i = 0; i < 40; i++) {
      c.tick(50);
      m.frame();
    }
    // 100 frames over 5 seconds of running time: 20 per second.
    expect(m.sample()).toEqual({ kind: "continuous", fps: 20, seconds: 5 });
  });

  it("says rendering is on demand when the loop never ran, instead of reporting 0", () => {
    const c = clock();
    const m = createFpsMeter({ now: c.now, windowMs: 5000 });
    m.frame();
    c.tick(6000);
    expect(m.sample()).toBeNull();
    m.frame();
    c.tick(10_000);
    expect(m.sample()).toEqual({ kind: "on-demand", frames: 2, seconds: 16 });
    expect(m.sample()).toBeNull();
  });
});
