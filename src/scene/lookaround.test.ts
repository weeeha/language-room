import { describe, expect, it } from "vitest";
import { anglesFromSpawn, applyDrag, applyKey, clampPitch, PITCH_LIMIT, wrapYaw } from "./lookaround";

describe("look-around angles", () => {
  it("looks down -z with zero angles", () => {
    expect(anglesFromSpawn([0, 1.6, 2], [0, 1.6, -1])).toEqual({ yaw: 0, pitch: 0 });
  });
  it("tilts down when the target is lower", () => {
    const a = anglesFromSpawn([0, 1.6, 2], [0, 1.4, -1]);
    expect(a.pitch).toBeLessThan(0);
    expect(a.yaw).toBeCloseTo(0);
  });
  it("turns left toward -x", () => {
    expect(anglesFromSpawn([0, 0, 0], [-1, 0, 0]).yaw).toBeCloseTo(Math.PI / 2);
  });
  it("keeps the default view for a zero direction", () => {
    expect(anglesFromSpawn([1, 1, 1], [1, 1, 1])).toEqual({ yaw: 0, pitch: 0 });
  });
  it("clamps pitch", () => {
    expect(clampPitch(5)).toBe(PITCH_LIMIT);
    expect(clampPitch(-5)).toBe(-PITCH_LIMIT);
    expect(clampPitch(0.3)).toBe(0.3);
  });
  it("wraps yaw into minus pi to pi", () => {
    expect(wrapYaw(Math.PI * 3)).toBeCloseTo(Math.PI);
    expect(wrapYaw(-Math.PI * 2.5)).toBeCloseTo(-Math.PI / 2);
  });
  it("drag right turns left, drag down looks up, pitch stays clamped", () => {
    const next = applyDrag({ yaw: 0, pitch: 0 }, 100, 50);
    expect(next.yaw).toBeGreaterThan(0);
    expect(next.pitch).toBeGreaterThan(0);
    expect(applyDrag({ yaw: 0, pitch: 1.4 }, 0, 10000).pitch).toBe(PITCH_LIMIT);
  });
  it("arrow keys move the angles and other keys do nothing", () => {
    const from = { yaw: 0, pitch: 0 };
    expect(applyKey(from, "ArrowLeft")?.yaw).toBeGreaterThan(0);
    expect(applyKey(from, "ArrowRight")?.yaw).toBeLessThan(0);
    expect(applyKey(from, "ArrowUp")?.pitch).toBeGreaterThan(0);
    expect(applyKey({ yaw: 0, pitch: PITCH_LIMIT }, "ArrowUp")?.pitch).toBe(PITCH_LIMIT);
    expect(applyKey(from, "a")).toBeNull();
  });
});
