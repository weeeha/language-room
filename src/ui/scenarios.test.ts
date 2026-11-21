import { describe, expect, it } from "vitest";
import { createMemoryScenarioStore } from "../author/store";
import { validScenario } from "../scenario/fixture";
import type { Scenario } from "../scenario/validate";
import { bundledScenarios, entriesFromInputs, findScenario, libraryEntries, localEntries, resolveScenario } from "./scenarios";

function make(id: string, title: string, reviewed: boolean): Record<string, unknown> {
  const s = validScenario();
  s.id = id;
  s.title = title;
  if (!reviewed) delete s.reviewed;
  return s;
}

describe("library listing", () => {
  const bundled = entriesFromInputs([make("b-reviewed", "Bakery", true), make("b-open", "Airport", false)]);
  const local = entriesFromInputs([make("l-reviewed", "Clinic", true), make("l-open", "Market", false)]).map((e) => ({ ...e, source: "local" as const }));

  it("lists reviewed scenarios only, bundled and local, sorted by title", () => {
    expect(libraryEntries(bundled, local).map((e) => e.scenario.id)).toEqual(["b-reviewed", "l-reviewed"]);
  });
  it("lists nothing when nothing is reviewed", () => {
    expect(libraryEntries(bundled.filter((e) => !e.listed), local.filter((e) => !e.listed))).toEqual([]);
  });
  it("does not let a local scenario take the place of a bundled one with the same id", () => {
    const shadow = entriesFromInputs([{ ...make("b-reviewed", "Shadow", true) }]);
    const ids = libraryEntries(bundled, shadow).map((e) => e.scenario.title);
    expect(ids).toEqual(["Bakery"]);
  });
});

describe("direct links", () => {
  it("opens the bundled unreviewed café scenario by id in any build", () => {
    const entry = findScenario("lisbon-cafe-pt");
    expect(entry?.scenario.id).toBe("lisbon-cafe-pt");
    expect(entry?.listed).toBe(false);
  });
  it("the bundled café scenario is not in the library list", () => {
    expect(libraryEntries(bundledScenarios(), []).some((e) => e.scenario.id === "lisbon-cafe-pt")).toBe(false);
  });
  it("resolves a local scenario from the store, bundled first", async () => {
    const store = createMemoryScenarioStore();
    await store.put(make("mine", "Mine", false) as unknown as Scenario);
    await store.put(make("lisbon-cafe-pt", "Shadow", true) as unknown as Scenario);
    const mine = await resolveScenario("mine", store);
    expect(mine?.source).toBe("local");
    expect(mine?.listed).toBe(false);
    const cafe = await resolveScenario("lisbon-cafe-pt", store);
    expect(cafe?.source).toBe("bundled");
    expect(cafe?.scenario.title).not.toBe("Shadow");
    expect(await resolveScenario("nope", store)).toBeUndefined();
  });
  it("skips a stored record that no longer validates", async () => {
    const store = createMemoryScenarioStore();
    await store.put({ id: "broken" } as unknown as Scenario);
    expect(await localEntries(store)).toEqual([]);
  });
});
