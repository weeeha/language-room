import { describe, expect, it } from "vitest";
import type { LlmProvider } from "../../providers/llm";
import type { Scenario } from "../../scenario/validate";
import { checkLine } from "./index";

const scenario = {
  id: "cafe",
  version: 1,
  title: "Cafe",
  language: { code: "pt-PT", name: "European Portuguese" },
  level: "A1",
  place: { name: "Cafe" },
  character: { name: "Rui", role: "waiter", persona: "Friendly" },
  goal: { description: "Order a coffee", steps: [] },
  targets: { phrases: [], grammar: [] },
} as unknown as Scenario;

function fake(reply: () => string, counter: { n: number }): LlmProvider {
  return {
    kind: "llm",
    id: "fake",
    label: "Fake",
    paid: false,
    async complete() {
      counter.n += 1;
      return { text: reply() };
    },
  };
}

const issueJson = JSON.stringify({
  issues: [{ span: "uma café", type: "grammar", suggestion: "um café", rule: "gender" }],
});

describe("checkLine", () => {
  it("makes no reviewer call for a correct line", async () => {
    const a = { n: 0 };
    const r = { n: 0 };
    const out = await checkLine(
      { analyzer: fake(() => '{"issues":[]}', a), reviewer: fake(() => "{}", r) },
      { line: "Queria um café.", turnId: "t", scenario },
    );
    expect(out).toEqual([]);
    expect(a.n).toBe(1);
    expect(r.n).toBe(0);
  });

  it("shows an issue the reviewer confirms", async () => {
    const out = await checkLine(
      {
        analyzer: fake(() => issueJson, { n: 0 }),
        reviewer: fake(() => '{"verdict":"correct","reason":"Wrong gender."}', { n: 0 }),
      },
      { line: "Queria uma café.", turnId: "t", scenario },
    );
    expect(out[0]?.shown).toBe(true);
  });

  it("treats a throwing reviewer as unsure and not shown", async () => {
    const out = await checkLine(
      {
        analyzer: fake(() => issueJson, { n: 0 }),
        reviewer: fake(() => {
          throw new Error("boom");
        }, { n: 0 }),
      },
      { line: "Queria uma café.", turnId: "t", scenario },
    );
    expect(out[0]?.verdict).toBe("unsure");
    expect(out[0]?.shown).toBe(false);
  });

  it("propagates an analyzer error", async () => {
    await expect(
      checkLine(
        {
          analyzer: fake(() => {
            throw new Error("down");
          }, { n: 0 }),
          reviewer: fake(() => "{}", { n: 0 }),
        },
        { line: "x", turnId: "t", scenario },
      ),
    ).rejects.toThrow("down");
  });
});
