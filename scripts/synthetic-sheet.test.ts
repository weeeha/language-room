import { describe, expect, it } from "vitest";
import type { Issue } from "../src/conversation/corrections";
import type { Session } from "../src/conversation/session";
import type { Recap } from "../src/recap/build";
import { buildSheet, HEADER, scoreErrors, type ScriptLine, type SheetInput } from "./synthetic-sheet";

const script: ScriptLine[] = [
  { id: "l1", text: "Bom dia." },
  { id: "l2", text: "Queria uma café, por favor.", error: { kind: "gender article", span: "uma café", expected: "um café", correctedLine: "Queria um café, por favor." } },
  { id: "l3", text: "Eu não sabe.", error: { kind: "verb form", span: "sabe", expected: "sei", correctedLine: "Eu não sei." } },
];

function issue(over: Partial<Issue> & { turnId: string }): Issue {
  return { id: "i", span: "uma café", type: "grammar", suggestion: "um café", rule: "Article gender", verdict: "correct", reason: "r", shown: true, ...over };
}

function input(issues: Issue[], l3Text = "Eu não sabe."): SheetInput {
  const session = {
    id: "s",
    scenarioId: "cafe",
    scenarioVersion: 1,
    startedAt: 0,
    endReason: "learner",
    turns: [
      { id: "c0", role: "character", text: "Bom dia.", at: 0 },
      { id: "t1", role: "learner", text: "Bom dia.", at: 1 },
      { id: "t2", role: "learner", text: "Queria uma café, por favor.", at: 2 },
      { id: "t3", role: "learner", text: l3Text, at: 3 },
    ],
    issues,
    stepsDone: [],
    providers: { stt: "", llm: "", analyzer: "", reviewer: "", tts: "" },
    errors: [],
  } as Session;
  const recap = { sessionId: "s", phrasesUsed: [], mistakes: [], practise: [], generatedAt: 0, summary: { learnerTurns: 3, stepsDone: 0, stepsTotal: 3 } } as Recap;
  return {
    date: "2026-11-21",
    scenarioId: "cafe",
    level: "A2",
    models: { llm: "m", stt: "s", tts: "t", voice: "v" },
    session,
    recap,
    script,
    turnScriptIds: { t1: "l1", t2: "l2", t3: "l3" },
    median: null,
  };
}

describe("scoreErrors", () => {
  it("counts a shown issue with the expected correction as caught", () => {
    const s = scoreErrors(input([issue({ turnId: "t2" })]));
    expect(s).toMatchObject({ caught: 1, missed: 1, wrongOnCleanLines: 0 });
    expect(s.errors[1]?.reason).toBe("the analyzer found no issue");
  });
  it("counts shown issues on lines without a scripted error", () => {
    const s = scoreErrors(input([issue({ turnId: "t1", span: "Bom dia", suggestion: "Bom dia!" })]));
    expect(s.wrongOnCleanLines).toBe(1);
  });
  it("does not count an issue that is not shown, and says why", () => {
    const s = scoreErrors(input([issue({ turnId: "t2", shown: false, verdict: "unsure" })]));
    expect(s.errors[0]).toMatchObject({ status: "missed" });
    expect(s.errors[0]?.reason).toMatch(/not shown \(verdict unsure/);
  });
  it("counts lines where the heard text differs", () => {
    expect(scoreErrors(input([], "Eu não sei.")).heardDiffers).toBe(1);
  });
});

describe("buildSheet", () => {
  it("starts with the stand-in statement and has the review tables", () => {
    const i = input([issue({ turnId: "t2" })]);
    const text = buildSheet(i, scoreErrors(i));
    expect(text.split("\n")[2]).toBe(HEADER);
    expect(text).toContain("### Shown corrections");
    expect(text).toContain("### Character lines");
    expect(text).toContain("### Recap items");
    expect(text).toContain("### Anything the app missed");
    expect(text).not.toMatch(/—|!/);
  });
});
