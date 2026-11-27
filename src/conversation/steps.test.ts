import { describe, expect, it } from "vitest";
import type { LlmProvider } from "../providers/llm";
import type { Scenario } from "../scenario/validate";
import { buildStepsMessages, judgeSteps, parseStepsOutput } from "./steps";

const scenario = {
  id: "cafe",
  version: 1,
  title: "Cafe",
  language: { code: "pt-PT", name: "European Portuguese" },
  level: "A2",
  place: { name: "Cafe" },
  character: { name: "Rui", role: "waiter", persona: "Friendly" },
  goal: {
    description: "Order a coffee",
    steps: [
      { id: "greet", hint: "Say good morning." },
      { id: "order", hint: "Ask for a coffee." },
      { id: "pay", hint: "Ask for the bill." },
    ],
  },
  targets: { phrases: [], grammar: [] },
} as unknown as Scenario;
const ids = ["greet", "order", "pay"];

// Replies captured from gemma-4-E4B-it-Q8_0 on 2026-11-27 with the evidence prompt, on the learner lines of
// eval/transcripts/phase-2-synthetic-2026-11-21.json. The old prompt answered the same lines with
// {"missing":["pay: say thank you"],"done":["greet","order","pay"]}, and the "missing" entry kept pay open.
const syntheticLines = [
  "Bom dia.",
  "Queria uma café e um pastel de nata, por favor.",
  "Sim, é tudo. Quanto é?",
  "Eu não sabe quanto custa o galão.",
  "Gosto muito de um café daqui.",
  "A conta? Por favor. Obrigado.",
];
const replyBillAndThanks =
  '{ "parts": [ { "step": "greet", "part": "Say good morning.", "quote": "Bom dia.", "translation": "Good morning.", "covers": true }, { "step": "order", "part": "Ask for a coffee", "quote": "Queria uma café", "translation": "I would like a coffee", "covers": true }, { "step": "order", "part": "and a pastel de nata.", "quote": "e um pastel de nata", "translation": "and a pastel de nata", "covers": true }, { "step": "pay", "part": "Ask for the bill", "quote": "A conta?", "translation": "The bill?", "covers": true }, { "step": "pay", "part": "and say thank you.", "quote": "Obrigado.", "translation": "Thank you.", "covers": true } ] }';
// Same session with the last line replaced by "Obrigado." only: the model quotes the price question and marks it as not covering the bill.
const replyThanksNoBill =
  '{ "parts": [ { "step": "greet", "part": "Say good morning.", "quote": "Bom dia.", "translation": "Good morning.", "covers": true }, { "step": "order", "part": "Ask for a coffee", "quote": "Queria uma café", "translation": "I would like a coffee", "covers": true }, { "step": "order", "part": "and a pastel de nata.", "quote": "e um pastel de nata", "translation": "and a pastel de nata", "covers": true }, { "step": "pay", "part": "Ask for the bill", "quote": "Quanto é?", "translation": "How much is it?", "covers": false }, { "step": "pay", "part": "say thank you.", "quote": "Obrigado.", "translation": "Thank you.", "covers": true } ] }';

describe("parseStepsOutput", () => {
  it("marks a step done when every part has a quote from a learner line", () => {
    expect(parseStepsOutput(replyBillAndThanks, ids, syntheticLines)).toEqual(["greet", "order", "pay"]);
  });
  it("keeps a step open when the model says a part is not covered", () => {
    const lines = [...syntheticLines.slice(0, 5), "Obrigado."];
    expect(parseStepsOutput(replyThanksNoBill, ids, lines)).toEqual(["greet", "order"]);
  });
  it("keeps a step open when a part has an empty quote", () => {
    const reply = '{"parts":[{"step":"pay","part":"ask for the bill","quote":"A conta, por favor.","covers":true},{"step":"pay","part":"say thank you","quote":"","covers":false}]}';
    expect(parseStepsOutput(reply, ids, ["A conta, por favor."])).toEqual([]);
  });
  it("keeps a step open when the quote is in no learner line", () => {
    // The thanks was never said, but the model claims it was.
    const lines = [...syntheticLines.slice(0, 5), "A conta? Por favor."];
    expect(parseStepsOutput(replyBillAndThanks, ids, lines)).toEqual(["greet", "order"]);
    // A quote must match whole words, not part of a word.
    const partial = '{"parts":[{"step":"greet","part":"say good morning","quote":"dia","covers":true}]}';
    expect(parseStepsOutput(partial, ids, ["Bom diabo."])).toEqual([]);
  });
  it("ignores case and punctuation when it looks for the quote", () => {
    const reply = '{"parts":[{"step":"pay","part":"ask for the bill","quote":"a conta por favor","covers":true}]}';
    expect(parseStepsOutput(reply, ids, ["A conta? Por favor."])).toEqual(["pay"]);
  });
  it("does not mark a step from a reply without evidence", () => {
    expect(parseStepsOutput('{"missing":[],"done":["greet","order","pay"]}', ids, syntheticLines)).toBeNull();
    expect(parseStepsOutput('["greet"]', ids, syntheticLines)).toBeNull();
  });
  it("reads fenced JSON", () => {
    const reply = 'Here you go:\n```json\n{"parts":[{"step":"greet","part":"say good morning","quote":"Bom dia","covers":true}]}\n```';
    expect(parseStepsOutput(reply, ids, ["Bom dia."])).toEqual(["greet"]);
  });
  it("returns null for garbage", () => {
    expect(parseStepsOutput("I think they ordered.", ids, [])).toBeNull();
    expect(parseStepsOutput("{bad", ids, [])).toBeNull();
    expect(parseStepsOutput('{"parts":"greet"}', ids, [])).toBeNull();
  });
  it("drops unknown ids and malformed entries", () => {
    const reply = '{"parts":[{"step":"dance","part":"x","quote":"Bom dia","covers":true},3,{"step":"greet","part":"say good morning","quote":"Bom dia","covers":true}]}';
    expect(parseStepsOutput(reply, ids, ["Bom dia."])).toEqual(["greet"]);
  });
});

function fake(reply: () => string, seen?: { req?: unknown }): LlmProvider {
  return {
    kind: "llm",
    id: "fake",
    label: "Fake",
    paid: false,
    async complete(req) {
      if (seen) seen.req = req;
      return { text: reply() };
    },
  };
}

describe("buildStepsMessages", () => {
  it("asks for a quote and a verdict for every part of every hint", () => {
    const system = buildStepsMessages({ scenario, history: [], stepsDone: [] })[0]?.content ?? "";
    expect(system).toMatch(/every part/);
    expect(system).toMatch(/"parts"/);
    expect(system).toMatch(/"quote"/);
    expect(system).toMatch(/"covers"/);
    expect(system).not.toMatch(/"missing"/);
  });
});

describe("judgeSteps", () => {
  const history = [{ role: "learner" as const, text: "Bom dia." }];
  it("asks with json on, thinking off and temperature 0, and returns the union", async () => {
    const seen: { req?: unknown } = {};
    const reply = '{"parts":[{"step":"greet","part":"say good morning","quote":"Bom dia.","covers":true}]}';
    const out = await judgeSteps(fake(() => reply, seen), { scenario, history, stepsDone: ["pay"] });
    expect(out).toEqual(["greet", "pay"]);
    expect(seen.req).toMatchObject({ json: true, thinking: false, temperature: 0 });
  });
  it("marks pay on the synthetic session line that asks for the bill and says thanks", async () => {
    const lines = syntheticLines.map((text) => ({ role: "learner" as const, text }));
    const out = await judgeSteps(fake(() => replyBillAndThanks), { scenario, history: lines, stepsDone: ["greet", "order"] });
    expect(out).toEqual(["greet", "order", "pay"]);
  });
  it("keeps the previous steps on garbage or on a provider error", async () => {
    const errors: string[] = [];
    expect(await judgeSteps(fake(() => "nope"), { scenario, history, stepsDone: ["greet"], onError: (m) => errors.push(m) })).toEqual(["greet"]);
    const broken: LlmProvider = { ...fake(() => ""), complete: async () => { throw new Error("down"); } };
    expect(await judgeSteps(broken, { scenario, history, stepsDone: ["greet"], onError: (m) => errors.push(m) })).toEqual(["greet"]);
    expect(errors).toHaveLength(2);
  });
  it("puts the transcript and the step ids in the prompt", () => {
    const text = buildStepsMessages({ scenario, history, stepsDone: ["greet"] }).map((m) => m.content).join("\n");
    expect(text).toContain("order: Ask for a coffee.");
    expect(text).toContain("Learner: Bom dia.");
    expect(text).toContain("Already marked done: greet");
  });
  it("leaves the character's lines out and tells the model to be strict", () => {
    const mixed = [
      { role: "character" as const, text: "Quer a conta agora?" },
      { role: "learner" as const, text: "Quanto é?" },
    ];
    const text = buildStepsMessages({ scenario, history: mixed, stepsDone: [] }).map((m) => m.content).join("\n");
    expect(text).not.toContain("Quer a conta agora");
    expect(text).toContain("Learner: Quanto é?");
    expect(text).toContain("When you are unsure, the step is not done");
    expect(text).toContain("Asking the price is not asking for the bill");
  });
});
