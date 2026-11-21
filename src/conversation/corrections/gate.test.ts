import { describe, expect, it } from "vitest";
import { gate, recapIssues, shownIssues } from "./gate";
import type { ReviewedIssue } from "./types";

function issue(over: Partial<ReviewedIssue> = {}): ReviewedIssue {
  return {
    span: "uma café",
    type: "grammar",
    suggestion: "um café",
    rule: "gender",
    verdict: "correct",
    reason: "café is masculine.",
    ...over,
  };
}

let n = 0;
const ctx = (extra: { lowConfidenceWords?: string[] } = {}) => ({
  turnId: "t1",
  makeId: () => `i${++n}`,
  ...extra,
});

describe("gate", () => {
  it("shows a correct issue", () => {
    const [out] = gate([issue()], ctx());
    expect(out?.shown).toBe(true);
    expect(out?.turnId).toBe("t1");
    expect(out?.held).toBeUndefined();
  });

  it("keeps an incorrect issue but does not show it", () => {
    const out = gate([issue({ verdict: "incorrect" })], ctx());
    expect(out).toHaveLength(1);
    expect(out[0]?.shown).toBe(false);
  });

  it("keeps an unsure issue but does not show it", () => {
    const out = gate([issue({ verdict: "unsure" })], ctx());
    expect(out).toHaveLength(1);
    expect(out[0]?.shown).toBe(false);
    expect(recapIssues(out)).toEqual([]);
  });

  it("holds an issue on a low confidence word as possibly misheard", () => {
    const out = gate([issue({ span: "uma Café," })], ctx({ lowConfidenceWords: ["café"] }));
    expect(out[0]?.held).toBe("possibly-misheard");
    expect(out[0]?.shown).toBe(false);
  });

  it("holds whatever the verdict", () => {
    const out = gate([issue({ verdict: "unsure" })], ctx({ lowConfidenceWords: ["café"] }));
    expect(out[0]?.held).toBe("possibly-misheard");
  });

  it("does not hold when the low confidence word is elsewhere", () => {
    const out = gate([issue()], ctx({ lowConfidenceWords: ["obrigado"] }));
    expect(out[0]?.shown).toBe(true);
  });

  it("never shows a variety note as a correction", () => {
    const out = gate([issue({ varietyNote: true })], ctx());
    expect(out[0]?.shown).toBe(false);
  });

  it("gives every issue an id", () => {
    const out = gate([issue(), issue()], { turnId: "t2" });
    expect(out[0]?.id).toBeTruthy();
    expect(out[0]?.id).not.toBe(out[1]?.id);
  });
});

describe("shownIssues and recapIssues", () => {
  const all = gate(
    [
      issue(),
      issue({ verdict: "unsure" }),
      issue({ verdict: "incorrect" }),
      issue({ span: "a mesa" }),
      issue({ varietyNote: true }),
    ],
    { turnId: "t3", lowConfidenceWords: ["mesa"] },
  );

  it("shownIssues returns only shown", () => {
    expect(shownIssues(all).every((i) => i.shown)).toBe(true);
    expect(shownIssues(all)).toHaveLength(1);
  });

  it("recapIssues never returns unsure, incorrect, held or variety notes", () => {
    const recap = recapIssues(all);
    expect(recap).toHaveLength(1);
    for (const i of recap) {
      expect(i.verdict).toBe("correct");
      expect(i.shown).toBe(true);
      expect(i.held).toBeUndefined();
    }
  });
});
