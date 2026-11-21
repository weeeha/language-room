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
});
