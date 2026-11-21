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

describe("parseStepsOutput", () => {
  it("reads plain and fenced JSON", () => {
    expect(parseStepsOutput('{"done":["greet","order"]}', ids)).toEqual(["greet", "order"]);
    expect(parseStepsOutput('Here you go:\n```json\n{"done":["pay"]}\n```', ids)).toEqual(["pay"]);
    expect(parseStepsOutput('["greet"]', ids)).toEqual(["greet"]);
  });
  it("returns null for garbage", () => {
    expect(parseStepsOutput("I think they ordered.", ids)).toBeNull();
    expect(parseStepsOutput("{bad", ids)).toBeNull();
    expect(parseStepsOutput('{"done":"greet"}', ids)).toBeNull();
  });
  it("drops unknown ids, non-strings and repeats", () => {
    expect(parseStepsOutput('{"done":["greet","dance",3,"greet"]}', ids)).toEqual(["greet"]);
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

describe("judgeSteps", () => {
  const history = [{ role: "learner" as const, text: "Bom dia." }];
  it("asks with json on, thinking off and temperature 0, and returns the union", async () => {
    const seen: { req?: unknown } = {};
    const out = await judgeSteps(fake(() => '{"done":["greet"]}', seen), { scenario, history, stepsDone: ["pay"] });
    expect(out).toEqual(["greet", "pay"]);
    expect(seen.req).toMatchObject({ json: true, thinking: false, temperature: 0 });
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
});
