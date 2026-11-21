import { describe, expect, it } from "vitest";
import { guardProvider } from "../providers/paid-guard";
import { checkSelectable, switchable } from "./switchable";

describe("switchable", () => {
  it("reads the current provider on every call and counts calls", async () => {
    const a = { id: "a", say: async () => "from a" };
    const b = { id: "b", say: async () => "from b" };
    let cur = a;
    let calls = 0;
    const s = switchable(() => cur, { say: (call) => { calls += 1; return call(); } });
    expect(s.id).toBe("a");
    expect(await s.say()).toBe("from a");
    cur = b;
    expect(s.id).toBe("b");
    expect(await s.say()).toBe("from b");
    expect(calls).toBe(2);
  });
  it("leaves out methods the current provider does not have", () => {
    const s = switchable(() => ({ id: "x" }) as { id: string; stop?: () => void });
    expect(s.stop).toBeUndefined();
  });
});

describe("checkSelectable", () => {
  const paid = { id: "llm-claude", label: "Claude", paid: true };
  const free = { id: "llm-local", label: "Local model", paid: false };
  it("refuses a paid provider while paid providers are off", () => {
    for (const flag of [undefined, "off", "", "ON", "true"]) {
      expect(checkSelectable(paid, flag)).toEqual({ ok: false, message: "Paid providers are off. Claude was not used." });
    }
  });
  it("accepts free providers and, when paid is on, paid ones", () => {
    expect(checkSelectable(free, "off")).toEqual({ ok: true });
    expect(checkSelectable(paid, "on")).toEqual({ ok: true });
  });
  it("matches what the guard does on a real call: no request is made", async () => {
    let fetched = false;
    const guarded = guardProvider(
      { id: "llm-claude", paid: true, async complete() { fetched = true; return { text: "" }; } },
      () => "off",
    );
    expect(() => guarded.complete()).toThrow(/blocked/);
    expect(fetched).toBe(false);
  });
});
