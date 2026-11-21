import { describe, expect, it } from "vitest";
import { createMemoryStore, medianLatency, type Session, type Turn } from "./session";

function session(turns: Turn[] = []): Session {
  return {
    id: "s1",
    scenarioId: "cafe",
    scenarioVersion: 1,
    startedAt: 0,
    turns,
    issues: [],
    stepsDone: [],
    providers: { stt: "a", llm: "b", analyzer: "c", reviewer: "d", tts: "e" },
    errors: [],
  };
}

const t = (role: Turn["role"], latencyMs?: number): Turn => ({ id: Math.random().toString(), role, text: "x", at: 0, latencyMs });

describe("memory store", () => {
  it("returns copies, so mutating a result does not change the stored session", async () => {
    const store = createMemoryStore();
    const original = session([t("learner")]);
    await store.save(original);
    original.stepsDone.push("late-change");
    const got = await store.get("s1");
    expect(got?.stepsDone).toEqual([]);
    got!.turns.length = 0;
    expect((await store.get("s1"))?.turns).toHaveLength(1);
    (await store.list())[0]!.errors.push({ at: 1, where: "x", message: "y" });
    expect((await store.get("s1"))?.errors).toEqual([]);
  });

  it("replaces a session saved twice and returns undefined for an unknown id", async () => {
    const store = createMemoryStore();
    await store.save(session());
    await store.save({ ...session(), endReason: "learner" });
    expect(await store.list()).toHaveLength(1);
    expect((await store.get("s1"))?.endReason).toBe("learner");
    expect(await store.get("nope")).toBeUndefined();
  });
});

describe("medianLatency", () => {
  it("is null when no character turn has a latency", () => {
    expect(medianLatency(session([t("learner", 5), t("character")]))).toBeNull();
  });
  it("takes the middle value of an odd count and ignores learner turns", () => {
    expect(medianLatency(session([t("character", 900), t("learner", 1), t("character", 100), t("character", 500)]))).toBe(500);
  });
  it("averages the two middle values of an even count", () => {
    expect(medianLatency(session([t("character", 100), t("character", 300), t("character", 200), t("character", 1000)]))).toBe(250);
  });
});
