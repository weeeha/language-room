import { describe, expect, it } from "vitest";
import { isSpaceToggleTarget } from "./Mic";

describe("isSpaceToggleTarget", () => {
  it("toggles when focus is on the page", () => {
    expect(isSpaceToggleTarget("BODY", false)).toBe(true);
    expect(isSpaceToggleTarget("DIV", false)).toBe(true);
    expect(isSpaceToggleTarget(undefined, false)).toBe(true);
  });
  it("leaves the space bar alone in fields, buttons and links", () => {
    for (const tag of ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"]) {
      expect(isSpaceToggleTarget(tag, false)).toBe(false);
    }
    expect(isSpaceToggleTarget("DIV", true)).toBe(false);
  });
});
