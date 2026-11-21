import { describe, expect, it } from "vitest";
import { validScenario } from "./fixture";
import { validateScenario } from "./validate";

describe("validateScenario", () => {
  it("accepts a valid scenario", () => {
    const result = validateScenario(validScenario());
    expect(result.valid).toBe(true);
  });

  it("rejects a scenario with no level and names the field", () => {
    const input = validScenario();
    delete input.level;
    const result = validateScenario(input);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.join("\n")).toContain("level");
    }
  });

  it("rejects level C2", () => {
    const input = validScenario();
    input.level = "C2";
    const result = validateScenario(input);
    expect(result.valid).toBe(false);
  });

  it("accepts a scenario with no place.scene", () => {
    const input = validScenario();
    delete (input.place as Record<string, unknown>).scene;
    const result = validateScenario(input);
    expect(result.valid).toBe(true);
  });

  it("flags a scenario with no reviewed entry as unlisted", () => {
    const input = validScenario();
    delete input.reviewed;
    const result = validateScenario(input);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.listed).toBe(false);
      expect(result.warnings.join("\n")).toContain("unlisted");
    }
  });

  it("accepts a character anchor and keeps it optional", () => {
    expect(validateScenario(validScenario()).valid).toBe(true);
    const input = validScenario();
    (input.character as Record<string, unknown>).anchor = [0, 1.5, -2];
    expect(validateScenario(input).valid).toBe(true);
  });

  it("rejects a character anchor that is not three numbers", () => {
    const input = validScenario();
    (input.character as Record<string, unknown>).anchor = [0, 1];
    const result = validateScenario(input);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors.join("\n")).toContain("character.anchor");
  });
});
