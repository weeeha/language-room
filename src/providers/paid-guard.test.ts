import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PaidProviderBlockedError,
  assertPaidAllowed,
  guardProvider,
  isPaidAllowed,
} from "./paid-guard";
import { createClaudeLlm } from "./adapters/llm-claude";
import { createHostedStt } from "./adapters/stt-hosted";
import { createHostedTts } from "./adapters/tts-hosted";
import { createLocalLlm } from "./adapters/llm-local";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch() {
  const spy = vi.fn(async () => new Response(JSON.stringify({ text: "ok" }), { status: 200 }));
  vi.stubGlobal("fetch", spy);
  return spy;
}

const blockedFlags: [string, string | undefined][] = [
  ["off", "off"],
  ["undefined", undefined],
  ["empty", ""],
  ["ON with a space", "ON "],
  ["uppercase", "ON"],
  ["true", "true"],
];

describe("isPaidAllowed", () => {
  it("is true only for the exact string on", () => {
    expect(isPaidAllowed("on")).toBe(true);
    for (const [, flag] of blockedFlags) expect(isPaidAllowed(flag)).toBe(false);
  });
});

describe("assertPaidAllowed", () => {
  it("throws for a paid provider when off and never for a free one", () => {
    expect(() => assertPaidAllowed({ id: "x", paid: true }, "off")).toThrow(PaidProviderBlockedError);
    expect(() => assertPaidAllowed({ id: "x", paid: false }, "off")).not.toThrow();
    expect(() => assertPaidAllowed({ id: "x", paid: true }, "on")).not.toThrow();
  });
  it("carries the provider id", () => {
    try {
      assertPaidAllowed({ id: "llm-claude", paid: true }, undefined);
      expect.unreachable();
    } catch (e) {
      expect((e as PaidProviderBlockedError).providerId).toBe("llm-claude");
    }
  });
});

describe.each(blockedFlags)("guarded paid adapters with the flag %s", (_name, flag) => {
  it("throws before any fetch", () => {
    const spy = stubFetch();
    const llm = guardProvider(createClaudeLlm(), () => flag);
    const stt = guardProvider(createHostedStt(), () => flag);
    const tts = guardProvider(createHostedTts(), () => flag);
    expect(() => llm.complete({ messages: [{ role: "user", content: "hi" }] })).toThrow(PaidProviderBlockedError);
    expect(() => stt.listenOnce({ lang: "pt-PT" })).toThrow(PaidProviderBlockedError);
    expect(() => tts.speak("ola", { lang: "pt-PT" })).toThrow(PaidProviderBlockedError);
    expect(spy).toHaveBeenCalledTimes(0);
  });
});

describe("guarded paid adapters with the flag on", () => {
  it("lets the Claude adapter reach fetch once", async () => {
    const spy = stubFetch();
    const llm = guardProvider(createClaudeLlm(), () => "on");
    const out = await llm.complete({ messages: [{ role: "user", content: "hi" }] });
    expect(out.text).toBe("ok");
    expect(spy).toHaveBeenCalledTimes(1);
    const call = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe("/api/llm");
    expect(JSON.parse(String(call[1].body)).provider).toBe("claude");
  });

  it("reads the flag at call time", () => {
    stubFetch();
    let flag: string | undefined = "on";
    const llm = guardProvider(createClaudeLlm(), () => flag);
    void llm.complete({ messages: [] });
    flag = "off";
    expect(() => llm.complete({ messages: [] })).toThrow(PaidProviderBlockedError);
  });
});

describe("free adapters", () => {
  it("are never blocked", async () => {
    const spy = stubFetch();
    const llm = guardProvider(createLocalLlm(), () => "off");
    await expect(llm.complete({ messages: [{ role: "user", content: "hi" }] })).resolves.toEqual({ text: "ok" });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
