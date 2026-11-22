import { describe, expect, it } from "vitest";
import { createMemoryStore, type Session } from "../conversation/session";
import type { LlmProvider } from "../providers/llm";
import type { Scenario } from "../scenario/validate";
import { loadRecap } from "./load";

const scenario = {
  id: "cafe",
  version: 1,
  title: "Cafe",
  language: { code: "pt-PT", name: "European Portuguese" },
  level: "A2",
  place: { name: "P" },
  character: { name: "R", role: "r", persona: "p" },
  goal: { description: "g", steps: [{ id: "greet", hint: "h" }] },
  targets: { phrases: ["Bom dia", "A conta, por favor", "Quanto é?"], grammar: [] },
} as unknown as Scenario;

function counting(): LlmProvider & { n: number } {
  const p = {
    n: 0,
    kind: "llm" as const,
    id: "f",
    label: "F",
    paid: false,
    async complete() {
      p.n += 1;
      return { text: "{}" };
    },
  };
  return p;
}

const base: Session = {
  id: "s1",
  scenarioId: "cafe",
  scenarioVersion: 1,
  startedAt: 1,
  endedAt: 2,
  turns: [{ id: "l1", role: "learner", text: "Bom dia", at: 1 }],
  issues: [],
  stepsDone: [],
  providers: { stt: "", llm: "", analyzer: "", reviewer: "", tts: "" },
  errors: [],
};

describe("loadRecap", () => {
  it("reports a session that does not exist", async () => {
    const llm = counting();
    const out = await loadRecap({ store: createMemoryStore(), llm, reviewer: llm }, scenario, "nope");
    expect(out).toEqual({ state: "not-found" });
  });

  it("reports a session of another scenario as not found", async () => {
    const store = createMemoryStore();
    await store.save({ ...base, scenarioId: "other" });
    const llm = counting();
    expect((await loadRecap({ store, llm, reviewer: llm }, scenario, "s1")).state).toBe("not-found");
  });

  it("builds once, keeps the recap on the session and reuses it", async () => {
    const store = createMemoryStore();
    await store.save(base);
    const llm = counting();
    const first = await loadRecap({ store, llm, reviewer: llm, now: () => 7 }, scenario, "s1");
    expect(first.state).toBe("ready");
    const callsAfterFirst = llm.n;
    expect((await store.get("s1"))?.recap?.generatedAt).toBe(7);
    const second = await loadRecap({ store, llm, reviewer: llm, now: () => 99 }, scenario, "s1");
    expect(llm.n).toBe(callsAfterFirst);
    expect(second.state === "ready" && second.recap.generatedAt).toBe(7);
  });

  it("does not keep the recap of a session that has not ended", async () => {
    const store = createMemoryStore();
    await store.save({ ...base, endedAt: undefined });
    const llm = counting();
    await loadRecap({ store, llm, reviewer: llm }, scenario, "s1");
    expect((await store.get("s1"))?.recap).toBeUndefined();
  });
});
