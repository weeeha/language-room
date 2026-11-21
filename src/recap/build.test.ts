import { describe, expect, it } from "vitest";
import type { Issue } from "../conversation/corrections";
import type { Session, Turn } from "../conversation/session";
import type { LlmProvider, LlmRequest } from "../providers/llm";
import type { Scenario } from "../scenario/validate";
import { buildRecap, mistakesFrom, phrasesUsed, unmetTargets } from "./build";

const scenario = {
  id: "cafe",
  version: 1,
  title: "Coffee at a Lisbon café",
  language: { code: "pt-PT", name: "European Portuguese" },
  level: "A2",
  place: { name: "Pastelaria" },
  character: { name: "Dona Amélia", role: "owner", persona: "Friendly" },
  goal: {
    description: "Order",
    steps: [
      { id: "greet", hint: "Say good morning." },
      { id: "order", hint: "Ask for a coffee." },
      { id: "pay", hint: "Ask for the bill." },
    ],
  },
  targets: { phrases: ["Bom dia", "Queria um café, por favor", "A conta, por favor", "Quanto é?"], grammar: [] },
} as unknown as Scenario;

function turn(id: string, role: Turn["role"], text: string): Turn {
  return { id, role, text, at: 1 };
}

function issue(over: Partial<Issue> & { id: string; turnId: string }): Issue {
  return {
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

function session(turns: Turn[], issues: Issue[] = [], stepsDone: string[] = []): Session {
  return {
    id: "s1",
    scenarioId: "cafe",
    scenarioVersion: 1,
    startedAt: 1,
    endedAt: 2,
    endReason: "learner",
    turns,
    issues,
    stepsDone,
    providers: { stt: "", llm: "", analyzer: "", reviewer: "", tts: "" },
    errors: [],
  };
}

const threeTurns = [
  turn("c0", "character", "Bom dia. Diga, faz favor."),
  turn("l1", "learner", "Bom dia."),
  turn("c1", "character", "Bom dia. O que vai ser?"),
  turn("l2", "learner", "Queria uma café, por favor."),
  turn("c2", "character", "Já trago o café."),
  turn("l3", "learner", "Sim, um pastel de nata. Quanto é?"),
];

function llmOf(fn: (req: LlmRequest) => string | Promise<string>): LlmProvider & { calls: LlmRequest[] } {
  const calls: LlmRequest[] = [];
  return {
    kind: "llm",
    id: "fake",
    label: "Fake",
    paid: false,
    calls,
    async complete(req) {
      calls.push(req);
      return { text: await fn(req) };
    },
  };
}

const reviewerOk = () => llmOf(() => '{"verdict":"correct","reason":"fine","varietyNote":false}');

function goodWriter(phrases: string[]): string {
  return JSON.stringify({
    items: phrases.map((p) => ({ phrase: p, why: `Why ${p}.`, example: `Example ${p}.` })),
  });
}

const inTranscriptOrTargets = (phrase: string, s: Session): boolean => {
  const norm = (x: string) => ` ${x.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean).join(" ")} `;
  const p = norm(phrase);
  return (
    s.turns.some((t) => norm(t.text).includes(p)) || scenario.targets.phrases.some((t) => norm(t).includes(p))
  );
};

describe("phrasesUsed", () => {
  it("matches ignoring case, punctuation and extra spaces, keeps accents", () => {
    const s = session([
      turn("l1", "learner", "  bom   DIA!! "),
      turn("l2", "learner", "quanto e?"),
      turn("l3", "learner", "QUANTO É"),
    ]);
    expect(phrasesUsed(s, scenario)).toEqual(["Bom dia", "Quanto é?"]);
  });

  it("is in transcript order and has no duplicates", () => {
    const s = session([
      turn("l1", "learner", "Quanto é?"),
      turn("l2", "learner", "Bom dia"),
      turn("l3", "learner", "Quanto é? Bom dia"),
    ]);
    expect(phrasesUsed(s, scenario)).toEqual(["Quanto é?", "Bom dia"]);
  });

  it("ignores character turns", () => {
    const s = session([turn("c1", "character", "Bom dia. Quanto é?")]);
    expect(phrasesUsed(s, scenario)).toEqual([]);
  });

  it("does not count a phrase whose error carries a shown correction", () => {
    const s = session(
      [turn("l1", "learner", "Queria um café, por favor")],
      [issue({ id: "i1", turnId: "l1", span: "um café", suggestion: "uma bica" })],
    );
    expect(phrasesUsed(s, scenario)).toEqual([]);
  });

  it("still counts a phrase when the shown correction sits elsewhere in the turn", () => {
    const s = session(
      [turn("l1", "learner", "Bom dia, uma café")],
      [issue({ id: "i1", turnId: "l1" })],
    );
    expect(phrasesUsed(s, scenario)).toEqual(["Bom dia"]);
  });

  it("does not match inside a longer word", () => {
    const s = session([turn("l1", "learner", "Bom diagrama")]);
    expect(phrasesUsed(s, scenario)).toEqual([]);
  });
});

describe("mistakesFrom", () => {
  it("builds the corrected line by replacing the span", () => {
    const s = session(threeTurns, [issue({ id: "i1", turnId: "l2" })]);
    expect(mistakesFrom(s)).toEqual([
      {
        learnerText: "Queria uma café, por favor.",
        corrected: "Queria um café, por favor.",
        rule: "Article gender",
        reason: "Café is masculine, so it takes um.",
        turnId: "l2",
      },
    ]);
  });

  it("never lists unsure, incorrect or held issues, or issues that are not shown", () => {
    const s = session(threeTurns, [
      issue({ id: "u", turnId: "l2", verdict: "unsure", shown: false }),
      issue({ id: "n", turnId: "l2", verdict: "incorrect", shown: false }),
      issue({ id: "h", turnId: "l2", held: "possibly-misheard", shown: false }),
      issue({ id: "x", turnId: "l2", shown: false }),
    ]);
    expect(mistakesFrom(s)).toEqual([]);
  });

  it("drops an issue whose span is not in the line", () => {
    const s = session(threeTurns, [issue({ id: "i1", turnId: "l2", span: "uma pastel" })]);
    expect(mistakesFrom(s)).toEqual([]);
  });
});

describe("unmetTargets", () => {
  it("lists targets the learner did not use, in target order", () => {
    const s = session(threeTurns, [issue({ id: "i1", turnId: "l2" })]);
    expect(unmetTargets(s, scenario)).toEqual(["Queria um café, por favor", "A conta, por favor"]);
  });
});

describe("buildRecap", () => {
  it("never shows unsure or incorrect issues in the recap", async () => {
    const s = session(threeTurns, [
      issue({ id: "i1", turnId: "l2" }),
      issue({ id: "u", turnId: "l3", span: "Quanto é", suggestion: "Quanto custa", verdict: "unsure", shown: false }),
      issue({ id: "n", turnId: "l1", span: "Bom dia", suggestion: "Olá", verdict: "incorrect", shown: false }),
    ]);
    const recap = await buildRecap({ llm: llmOf(() => "{}"), reviewer: reviewerOk(), now: () => 5 }, s, scenario);
    expect(recap.mistakes.map((m) => m.turnId)).toEqual(["l2"]);
    const all = JSON.stringify(recap);
    expect(all).not.toContain("Quanto custa");
    expect(all).not.toContain("Olá");
    expect(recap.generatedAt).toBe(5);
    expect(recap.summary).toEqual({ learnerTurns: 3, stepsDone: 0, stepsTotal: 3 });
  });

  it("a session with no mistakes still has three practise phrases from unmet targets first", async () => {
    const s = session(
      [turn("c0", "character", "Bom dia."), turn("l1", "learner", "Bom dia."), turn("l2", "learner", "Quanto é?")],
      [],
      ["greet"],
    );
    const recap = await buildRecap({ llm: llmOf(() => "{}"), reviewer: reviewerOk() }, s, scenario);
    expect(recap.mistakes).toEqual([]);
    expect(recap.practise).toHaveLength(3);
    expect(recap.practise.map((p) => p.phrase)).toEqual(["Queria um café, por favor", "A conta, por favor", "Bom dia"]);
    expect(recap.practise.map((p) => p.source)).toEqual(["unmet-target", "unmet-target", "target"]);
    expect(recap.summary.stepsDone).toBe(1);
  });

  it("puts the corrected sentence first when it is a target phrase", async () => {
    const s = session(threeTurns, [issue({ id: "i1", turnId: "l2" })]);
    const recap = await buildRecap({ llm: llmOf(() => "{}"), reviewer: reviewerOk() }, s, scenario);
    expect(recap.practise[0]).toMatchObject({ phrase: "Queria um café, por favor.", source: "mistake" });
    expect(recap.practise).toHaveLength(3);
    // The corrected sentence is the same target, so it is not listed twice.
    expect(recap.practise.map((p) => p.phrase.toLowerCase().replace(/[^\p{L}\s]/gu, "")).filter((p) => p.startsWith("queria"))).toHaveLength(1);
  });

  it("uses the contained target when the corrected sentence is longer than any target", async () => {
    const s = session(
      [turn("l1", "learner", "Bom dia, uma café com leite. Queria um café, por favor")],
      [issue({ id: "i1", turnId: "l1", span: "uma café", suggestion: "um café" })],
    );
    const recap = await buildRecap({ llm: llmOf(() => "{}"), reviewer: reviewerOk() }, s, scenario);
    expect(recap.practise[0]?.source).toBe("mistake");
    expect(["Bom dia", "Queria um café, por favor"]).toContain(recap.practise[0]?.phrase);
  });

  it("ranks a mistake phrase the learner later said correctly after one they did not", async () => {
    const s = session(
      [
        turn("l1", "learner", "Queria uma café, por favor."),
        turn("l2", "learner", "Queria um café, por favor."),
        turn("l3", "learner", "A conta, por favour."),
      ],
      [
        issue({ id: "i1", turnId: "l1" }),
        issue({ id: "i2", turnId: "l3", span: "por favour", suggestion: "por favor", rule: "Spelling" }),
      ],
    );
    const recap = await buildRecap({ llm: llmOf(() => "{}"), reviewer: reviewerOk() }, s, scenario);
    expect(recap.practise.map((p) => p.phrase)).toEqual(["A conta, por favor.", "Queria um café, por favor.", "Bom dia"]);
    expect(recap.practise.map((p) => p.source)).toEqual(["mistake", "mistake", "unmet-target"]);
  });

  it("puts target phrases already used correctly last within the unmet and other groups", async () => {
    const s = session([turn("l1", "learner", "Bom dia."), turn("l2", "learner", "Queria um café, por favor.")]);
    const recap = await buildRecap({ llm: llmOf(() => "{}"), reviewer: reviewerOk() }, s, scenario);
    expect(recap.practise.map((p) => p.phrase)).toEqual(["A conta, por favor", "Quanto é?", "Bom dia"]);
    expect(recap.practise.map((p) => p.source)).toEqual(["unmet-target", "unmet-target", "target"]);
  });

  it("has exactly three practise phrases with a one-turn session", async () => {
    const s = session([turn("c0", "character", "Bom dia."), turn("l1", "learner", "Bom dia.")]);
    const recap = await buildRecap({ llm: llmOf(() => "{}"), reviewer: reviewerOk() }, s, scenario);
    expect(recap.summary.learnerTurns).toBe(1);
    expect(recap.practise).toHaveLength(3);
    expect(recap.phrasesUsed).toEqual(["Bom dia"]);
  });

  it("keeps every practise phrase inside the transcript or the targets, whatever the model writes", async () => {
    const s = session(threeTurns, [issue({ id: "i1", turnId: "l2" })]);
    const outputs = [
      "{}",
      "not json at all",
      "[]",
      goodWriter(["Eu quero um chá", "Obrigado pelo café", "Adeus"]),
      JSON.stringify({ items: [{ phrase: "Frase inventada", why: "x", example: "y" }] }),
      goodWriter(["Queria um café, por favor.", "A conta, por favor", "Bom dia"]),
    ];
    for (const out of outputs) {
      const recap = await buildRecap({ llm: llmOf(() => out), reviewer: reviewerOk() }, s, scenario);
      expect(recap.practise).toHaveLength(3);
      for (const p of recap.practise) expect(inTranscriptOrTargets(p.phrase, s)).toBe(true);
      expect(JSON.stringify(recap.practise)).not.toContain("inventada");
    }
  });

  it("writes why and example from the model when the reviewer accepts them", async () => {
    const s = session([turn("l1", "learner", "Bom dia")]);
    const llm = llmOf(() => goodWriter(["Queria um café, por favor", "A conta, por favor", "Quanto é?"]));
    const recap = await buildRecap({ llm, reviewer: reviewerOk() }, s, scenario);
    expect(recap.practise[0]).toMatchObject({ why: "Why Queria um café, por favor.", example: "Example Queria um café, por favor." });
    expect(llm.calls).toHaveLength(1);
    expect(llm.calls[0]?.json).toBe(true);
    expect(llm.calls[0]?.thinking).not.toBe(true);
  });

  it("asks the reviewer with thinking on and replaces a rejected example by the phrase", async () => {
    const s = session([turn("l1", "learner", "Bom dia")]);
    const llm = llmOf(() => goodWriter(["Queria um café, por favor", "A conta, por favor", "Quanto é?"]));
    const reviewer = llmOf((req) => {
      const text = req.messages.map((m) => m.content).join("\n");
      const bad = text.includes("Example A conta");
      return JSON.stringify({ verdict: bad ? "incorrect" : "correct", reason: "r" });
    });
    const recap = await buildRecap({ llm, reviewer }, s, scenario);
    expect(recap.practise[1]?.example).toBe("A conta, por favor");
    expect(recap.practise[0]?.example).toBe("Example Queria um café, por favor.");
    expect(reviewer.calls.length).toBeGreaterThan(0);
    expect(reviewer.calls.every((c) => c.thinking === true)).toBe(true);
  });

  it("treats an unsure verdict and a failing reviewer as a rejection", async () => {
    const s = session([turn("l1", "learner", "Bom dia")]);
    const llm = llmOf(() => goodWriter(["Queria um café, por favor", "A conta, por favor", "Quanto é?"]));
    const unsure = await buildRecap({ llm, reviewer: llmOf(() => '{"verdict":"unsure","reason":"?"}') }, s, scenario);
    expect(unsure.practise.map((p) => p.example)).toEqual(unsure.practise.map((p) => p.phrase));
    const failing = llmOf(() => {
      throw new Error("down");
    });
    const down = await buildRecap({ llm, reviewer: failing }, s, scenario);
    expect(down.practise.map((p) => p.example)).toEqual(down.practise.map((p) => p.phrase));
  });

  it("uses the fixed templates when the model call throws", async () => {
    const s = session(threeTurns, [issue({ id: "i1", turnId: "l2" })]);
    const llm = llmOf(() => {
      throw new Error("model down");
    });
    const recap = await buildRecap({ llm, reviewer: reviewerOk() }, s, scenario);
    expect(recap.practise).toHaveLength(3);
    expect(recap.practise[0]?.why).toBe("Practise the corrected form from this session.");
    expect(recap.practise[1]?.why).toBe("You did not reach this phrase in the conversation.");
    for (const p of recap.practise) expect(p.example).toBe(p.phrase);
  });

  it("falls back to the template for a why that holds an exclamation mark or em dash", async () => {
    const s = session([turn("l1", "learner", "Bom dia")]);
    const llm = llmOf(() =>
      JSON.stringify({
        items: [
          { phrase: "Queria um café, por favor", why: "Great phrase!", example: "" },
          { phrase: "A conta, por favor", why: "Useful — always", example: "" },
        ],
      }),
    );
    const recap = await buildRecap({ llm, reviewer: reviewerOk() }, s, scenario);
    expect(recap.practise[0]?.why).toBe("You did not reach this phrase in the conversation.");
    expect(recap.practise[1]?.why).toBe("You did not reach this phrase in the conversation.");
  });

  it("fills from learner lines when the scenario has fewer than three targets and no mistakes", async () => {
    const small = { ...scenario, targets: { phrases: ["Bom dia"], grammar: [] } } as Scenario;
    const s = session([turn("l1", "learner", "Bom dia"), turn("l2", "learner", "Obrigada")]);
    const recap = await buildRecap({ llm: llmOf(() => "{}"), reviewer: reviewerOk() }, s, small);
    expect(recap.practise.map((p) => p.phrase)).toEqual(["Bom dia", "Obrigada"]);
  });
});
