import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validScenario } from "./fixture";
import { listScenarios, loadScenario } from "./load";
import { LEVELS, REQUIRED_FIELDS } from "./validate";

describe("schema file", () => {
  it("lists the same required fields and levels as the validator", () => {
    const schema = JSON.parse(
      readFileSync(new URL("../../scenarios/schema/scenario.schema.json", import.meta.url), "utf8"),
    );
    expect(schema.required).toEqual([...REQUIRED_FIELDS]);
    expect(schema.properties.level.enum).toEqual([...LEVELS]);
  });
});

describe("loadScenario", () => {
  it("parses a JSON string", () => {
    const result = loadScenario(JSON.stringify(validScenario()));
    expect(result.valid).toBe(true);
  });

  it("returns a clear error on bad JSON", () => {
    const result = loadScenario("{ not json");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors[0]).toContain("could not parse");
  });

  it("names the path of a nested error", () => {
    const input = validScenario();
    (input.level as unknown) = "C2";
    const result = loadScenario(input);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain("level: must be one of A1, A2, B1, B2");
  });

  it("rejects an empty signage text", () => {
    const input = validScenario();
    const place = input.place as { signage: { text: string }[] };
    place.signage[0]!.text = "  ";
    const result = loadScenario(input);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors[0]).toContain("place.signage[0].text");
  });
});

describe("listScenarios", () => {
  it("returns only valid, reviewed scenarios", () => {
    const unreviewed = validScenario();
    delete unreviewed.reviewed;
    const broken = validScenario();
    delete broken.level;
    const list = listScenarios([validScenario(), unreviewed, broken, "nope"]);
    expect(list.map((s) => s.id)).toEqual(["lisbon-cafe-pt"]);
  });
});
