import { describe, expect, it } from "vitest";
import { validScenario } from "../scenario/fixture";
import type { Scenario } from "../scenario/validate";
import { buildScenario, formFromScenario } from "./form";
import { applySignOff, clearReviewIfChanged, reconcileReview, reviewedTextKey, reviewLine, signOffProblem, todayIso } from "./review";

const reviewed = (): Scenario => validScenario() as unknown as Scenario;
const edit = (fn: (s: Scenario) => void): Scenario => {
  const s = structuredClone(reviewed());
  fn(s);
  return s;
};

describe("clear review when reviewed text changes", () => {
  const changes: [string, (s: Scenario) => void][] = [
    ["persona", (s) => void (s.character.persona = "Strict and fast.")],
    ["a target phrase", (s) => void (s.targets.phrases[0] = "Boa tarde")],
    ["a new target phrase", (s) => void s.targets.phrases.push("Obrigado")],
    ["a grammar target", (s) => void (s.targets.grammar[0] = "other")],
    ["a goal hint", (s) => void (s.goal.steps[0] && (s.goal.steps[0].hint = "Say hello."))],
    ["a sign text", (s) => void (s.place.signage && s.place.signage[0] && (s.place.signage[0].text = "Café 2,00"))],
    ["a hotspot word", (s) => void (s.place.hotspots && s.place.hotspots[0] && (s.place.hotspots[0].word = "o bolo"))],
  ];
  for (const [name, change] of changes) {
    it(`clears the review when ${name} changes`, () => {
      const result = clearReviewIfChanged(reviewed(), edit(change));
      expect(result.cleared).toBe(true);
      expect(result.scenario.reviewed).toBeUndefined();
    });
  }

  const keeps: [string, (s: Scenario) => void][] = [
    ["a hotspot position", (s) => void (s.place.hotspots && s.place.hotspots[0] && (s.place.hotspots[0].position = [9, 9, 9]))],
    ["a sign anchor", (s) => void (s.place.signage && s.place.signage[0] && (s.place.signage[0].anchor = [9, 9, 9]))],
    ["the spawn", (s) => void (s.place.scene && (s.place.scene.spawn.position = [5, 5, 5]))],
    ["the scene file", (s) => void (s.place.scene && (s.place.scene.file = "media/other/scene.spz"))],
    ["the name tag position", (s) => void (s.character.anchor = [1, 2, 3])],
    ["the title", (s) => void (s.title = "A different title")],
    ["the hotspot gloss", (s) => void (s.place.hotspots && s.place.hotspots[0] && (s.place.hotspots[0].gloss = "tart"))],
  ];
  for (const [name, change] of keeps) {
    it(`keeps the review when ${name} changes`, () => {
      const next = edit(change);
      const result = clearReviewIfChanged(reviewed(), next);
      expect(result.cleared).toBe(false);
      expect(result.scenario.reviewed).toEqual(reviewed().reviewed);
    });
  }

  it("does nothing to a scenario that has no review", () => {
    const next = edit((s) => {
      delete s.reviewed;
      s.character.persona = "Changed.";
    });
    expect(clearReviewIfChanged(reviewed(), next)).toEqual({ scenario: next, cleared: false });
  });

  it("is an exact comparison of the reviewed text", () => {
    expect(reviewedTextKey(reviewed())).toBe(reviewedTextKey(structuredClone(reviewed())));
  });
});

describe("review on the form state", () => {
  it("clears the block in the state when the persona changes and not when a coordinate changes", () => {
    const saved = reviewed();
    const state = formFromScenario(saved);
    const moved = { ...state, hotspots: state.hotspots.map((x) => ({ ...x, position: [3, 3, 3] as [number, number, number] })) };
    expect(reconcileReview(moved, saved)).toEqual({ state: moved, cleared: false });
    const changed = { ...state, persona: "Different." };
    const result = reconcileReview(changed, saved);
    expect(result.cleared).toBe(true);
    expect(result.state.reviewed).toBeUndefined();
    expect(buildScenario(result.state, 1).reviewed).toBeUndefined();
  });
});

describe("sign off", () => {
  it("needs a name, a real date and the confirmation", () => {
    expect(signOffProblem({ by: " ", on: "2026-11-21", confirmed: true })).toContain("name or id");
    expect(signOffProblem({ by: "ana", on: "21/11/2026", confirmed: true })).toContain("YYYY-MM-DD");
    expect(signOffProblem({ by: "ana", on: "2026-11-21", confirmed: false })).toContain("Confirm");
    expect(signOffProblem({ by: "ana", on: "2026-11-21", confirmed: true })).toBeNull();
  });
  it("writes reviewed by and on", () => {
    const base = formFromScenario({ ...reviewed(), reviewed: undefined } as Scenario);
    const signed = applySignOff(base, { by: " Ana Reis ", on: "2026-11-21", confirmed: true });
    expect(buildScenario(signed, 1).reviewed).toEqual({ by: "Ana Reis", on: "2026-11-21" });
  });
  it("formats today as YYYY-MM-DD and the card line", () => {
    expect(todayIso(new Date(2026, 10, 5))).toBe("2026-11-05");
    expect(reviewLine({ by: "ana", on: "2026-11-21" })).toBe("Reviewed by ana on 2026-11-21");
    expect(reviewLine(undefined)).toBe("Not reviewed");
  });
});
