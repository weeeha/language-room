import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateScenario } from "./validate";

function realFile(): Record<string, unknown> {
  const url = new URL("../../scenarios/lisbon-cafe-pt.json", import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as Record<string, unknown>;
}

describe("scenarios/lisbon-cafe-pt.json", () => {
  it("is valid and unlisted", () => {
    const result = validateScenario(realFile());
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.listed).toBe(false);
      expect(result.warnings.join(" ")).toContain("unlisted");
    }
  });

  it("is listed once a reviewed block is added", () => {
    const input = { ...realFile(), reviewed: { by: "test-reviewer", on: "2026-11-21" } };
    const result = validateScenario(input);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.listed).toBe(true);
  });

  it("is invalid without level", () => {
    const input = realFile();
    delete input.level;
    expect(validateScenario(input).valid).toBe(false);
  });
});
