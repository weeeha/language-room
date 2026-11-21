import { describe, expect, it } from "vitest";
import { toScreen } from "./screen";

describe("toScreen", () => {
  it("puts the centre of the view in the middle of the container", () => {
    const p = toScreen({ x: 0, y: 0, z: 0.5 }, -3, 400, 200);
    expect(p).toEqual({ x: 200, y: 100, visible: true });
  });
  it("flips y so up on screen is a smaller y", () => {
    expect(toScreen({ x: 0, y: 1, z: 0.5 }, -3, 400, 200).y).toBe(0);
  });
  it("hides a point behind the camera even when it lands inside the frame", () => {
    expect(toScreen({ x: 0.2, y: 0.2, z: 0.5 }, 2, 400, 200).visible).toBe(false);
    expect(toScreen({ x: 0.2, y: 0.2, z: 0.5 }, 0, 400, 200).visible).toBe(false);
  });
  it("hides a point outside the frame or the depth range", () => {
    expect(toScreen({ x: 1.2, y: 0, z: 0.5 }, -3, 400, 200).visible).toBe(false);
    expect(toScreen({ x: 0, y: -1.2, z: 0.5 }, -3, 400, 200).visible).toBe(false);
    expect(toScreen({ x: 0, y: 0, z: 1.5 }, -3, 400, 200).visible).toBe(false);
  });
  it("hides a point that is not a number", () => {
    expect(toScreen({ x: Number.NaN, y: 0, z: 0 }, -3, 400, 200).visible).toBe(false);
  });
});
