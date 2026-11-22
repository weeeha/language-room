import { describe, expect, it } from "vitest";
import type { Issue } from "../conversation/corrections";
import { chipsFor } from "./chips";

function issue(id: string, over: Partial<Issue>): Issue {
  return {
    id,
    turnId: "t1",
    span: "uma café",
    type: "grammar",
    suggestion: "um café",
    rule: "Article gender",
    verdict: "correct",
    reason: "Café is masculine, so it takes um.",
    shown: true,
    ...over,
  };
}

describe("chipsFor", () => {
  it("makes a chip for shown issues only", () => {
    const chips = chipsFor([
      issue("a", {}),
      issue("b", { verdict: "unsure", shown: false }),
      issue("c", { verdict: "incorrect", shown: false }),
      issue("d", { held: "possibly-misheard", shown: false }),
    ]);
    expect(chips).toEqual([
      { id: "a", suggestion: "um café", rule: "Article gender", reason: "Café is masculine, so it takes um." },
    ]);
  });
  it("returns nothing for no issues", () => {
    expect(chipsFor([])).toEqual([]);
  });
  it("does not carry the claimed span or verdict of hidden issues", () => {
    const text = JSON.stringify(chipsFor([issue("x", { shown: false, suggestion: "SECRET" })]));
    expect(text).not.toContain("SECRET");
  });
});
