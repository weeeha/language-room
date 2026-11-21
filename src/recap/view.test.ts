import { describe, expect, it } from "vitest";
import type { Issue } from "../conversation/corrections";
import type { Session } from "../conversation/session";
import type { Scenario } from "../scenario/validate";
import type { Recap, RecapMistake } from "./build";
import { recapKind, recapViewModel } from "./view";

const scenario = {
  id: "cafe",
  title: "Coffee at a Lisbon café",
  character: { name: "Dona Amélia" },
} as unknown as Scenario;

const mistake = (n: number): RecapMistake => ({
  learnerText: `a${n}`,
  corrected: `b${n}`,
  rule: "r",
  reason: `why${n}`,
  turnId: `l${n}`,
});

function recap(mistakes: RecapMistake[], learnerTurns = 3): Recap {
  return {
    sessionId: "s1",
    phrasesUsed: ["Bom dia"],
    mistakes,
    practise: [],
    generatedAt: 1,
    summary: { learnerTurns, stepsDone: 2, stepsTotal: 3 },
  };
}

function session(issues: Issue[] = []): Session {
  return {
    id: "s1",
    scenarioId: "cafe",
    scenarioVersion: 1,
    startedAt: 1,
    turns: [
      { id: "c0", role: "character", text: "Bom dia.", at: 1 },
      { id: "l1", role: "learner", text: "Queria uma café", at: 2 },
    ],
    issues,
    stepsDone: [],
    providers: { stt: "", llm: "", analyzer: "", reviewer: "", tts: "" },
    errors: [],
  };
}

const issue = (over: Partial<Issue>): Issue => ({
  id: "i",
  turnId: "l1",
  span: "uma café",
  type: "grammar",
  suggestion: "um café",
  rule: "Article gender",
  verdict: "correct",
  reason: "Café is masculine, so it takes um.",
  shown: true,
  ...over,
});

describe("recapViewModel", () => {
  it("shows all mistakes with no note up to five", () => {
    const vm = recapViewModel(recap([1, 2, 3, 4, 5].map(mistake)), session(), scenario);
    expect(vm.mistakes.first).toHaveLength(5);
    expect(vm.mistakes.rest).toHaveLength(0);
    expect(vm.mistakes.note).toBeNull();
  });

  it("splits more than five into the first five and the rest with the exact note", () => {
    const vm = recapViewModel(recap([1, 2, 3, 4, 5, 6, 7, 8].map(mistake)), session(), scenario);
    expect(vm.mistakes.first.map((m) => m.turnId)).toEqual(["l1", "l2", "l3", "l4", "l5"]);
    expect(vm.mistakes.rest.map((m) => m.turnId)).toEqual(["l6", "l7", "l8"]);
    expect(vm.mistakes.note).toBe("Showing the first 5 of 8 mistakes. Scroll for the rest.");
  });

  it("selects the state and the exact copy", () => {
    expect(recapKind(recap([mistake(1)]))).toBe("full");
    expect(recapKind(recap([]))).toBe("no-mistakes");
    expect(recapKind(recap([], 1))).toBe("one-turn");
    expect(recapKind(recap([mistake(1)], 1))).toBe("one-turn");
    const full = recapViewModel(recap([mistake(1)]), session(), scenario);
    expect(full.intro).toBe("You spoke 3 turns. You finished 2 of 3 goal steps.");
    expect(full.heading).toBe("Recap, Coffee at a Lisbon café");
    expect(recapViewModel(recap([]), session(), scenario).mistakes.empty).toBe(
      "No mistakes found in this session. The checker shows only corrections it is sure about, so a quiet recap does not prove every line was perfect.",
    );
    const one = recapViewModel(recap([], 1), session(), scenario);
    expect(one.intro).toBe(
      "You ended after 1 turn, so there is little to review. Phrases used are listed below. Try the full conversation to practise the order and the bill.",
    );
    expect(one.mistakes.empty).toBe("No mistakes found in this turn.");
  });

  it("puts only shown corrections under learner lines", () => {
    const vm = recapViewModel(
      recap([]),
      session([issue({ id: "a" }), issue({ id: "b", verdict: "unsure", shown: false, suggestion: "X" })]),
      scenario,
    );
    expect(vm.transcript[0]).toMatchObject({ who: "Dona Amélia", chips: [] });
    expect(vm.transcript[1]?.who).toBe("You");
    expect(vm.transcript[1]?.chips.map((c) => c.suggestion)).toEqual(["um café"]);
  });
});
