import { describe, expect, it } from "vitest";
import type { Session } from "../conversation/session";
import { lastFinishedSession } from "./lastRecap";
import { entriesFromInputs, availableEntries } from "./scenarios";

function session(id: string, endedAt?: number): Session {
  return {
    id,
    scenarioId: "cafe",
    scenarioVersion: 1,
    startedAt: 1,
    endedAt,
    turns: [],
    issues: [],
    stepsDone: [],
    providers: { stt: "", llm: "", analyzer: "", reviewer: "", tts: "" },
    errors: [],
  };
}

describe("lastFinishedSession", () => {
  it("ignores sessions that have not ended", () => {
    expect(lastFinishedSession([session("a"), session("b")])).toBeUndefined();
    expect(lastFinishedSession([])).toBeUndefined();
  });
  it("picks the one that ended last", () => {
    expect(lastFinishedSession([session("a", 10), session("b", 30), session("c", 20), session("d")])?.id).toBe("b");
  });
});

const base = {
  id: "x",
  version: 1,
  title: "Zed",
  language: { code: "pt-PT", name: "European Portuguese" },
  level: "A2",
  place: { name: "Place" },
  character: { name: "Rui", role: "waiter", persona: "Friendly" },
  goal: { description: "Order", steps: [{ id: "s", hint: "Say hi." }] },
  targets: { phrases: ["Bom dia"], grammar: [] },
};

describe("scenario entries", () => {
  it("lists a scenario only when it has a review, and shows unlisted ones in development", () => {
    const reviewed = { ...base, id: "a", title: "Alpha", reviewed: { by: "Ana", on: "2026-11-01" } };
    const unreviewed = { ...base, id: "b", title: "Beta" };
    const bad = { ...base, id: "c", level: undefined };
    const skipped: string[][] = [];
    const entries = entriesFromInputs([unreviewed, bad, reviewed], (e) => skipped.push(e));
    expect(entries.map((e) => [e.scenario.id, e.listed])).toEqual([["a", true], ["b", false]]);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.join(" ")).toContain("level");
    expect(availableEntries(entries, false).map((e) => e.scenario.id)).toEqual(["a"]);
    expect(availableEntries(entries, true).map((e) => e.scenario.id)).toEqual(["a", "b"]);
  });
});
