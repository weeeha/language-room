import { describe, expect, it } from "vitest";
import type { LlmProvider, LlmRequest } from "../providers/llm";
import type { TtsProvider } from "../providers/tts";
import { speakReply } from "./speak";

const req: LlmRequest = { messages: [{ role: "user", content: "Bom dia." }] };

/** A clock that advances only when a test says so. */
function clock() {
  let t = 0;
  return { now: () => t, tick: (ms: number) => void (t += ms) };
}

function fakeTts(clk: ReturnType<typeof clock>, opts: { failOn?: number; speakMs?: number } = {}) {
  const log: string[] = [];
  let active = 0;
  let overlapped = false;
  let calls = 0;
  const tts: TtsProvider = {
    kind: "tts",
    id: "fake",
    label: "Fake",
    paid: false,
    async speak(text, o) {
      calls += 1;
      active += 1;
      if (active > 1) overlapped = true;
      log.push(`start ${text}`);
      try {
        if (opts.failOn === calls) throw new Error("tts broke");
        await new Promise<void>((resolve, reject) => {
          const onAbort = () => reject(new DOMException("aborted", "AbortError"));
          if (o.signal?.aborted) return onAbort();
          o.signal?.addEventListener("abort", onAbort, { once: true });
          setTimeout(() => {
            clk.tick(opts.speakMs ?? 0);
            resolve();
          }, 0);
        });
        log.push(`end ${text}`);
      } finally {
        active -= 1;
      }
    },
  };
  return { tts, log, overlapped: () => overlapped };
}

function streamingLlm(clk: ReturnType<typeof clock>, deltas: string[], gapMs = 100): LlmProvider {
  return {
    kind: "llm",
    id: "fake",
    label: "Fake",
    paid: false,
    async complete() {
      throw new Error("complete should not be used");
    },
    async completeStream(_r, onDelta) {
      let text = "";
      for (const d of deltas) {
        clk.tick(gapMs);
        await Promise.resolve();
        text += d;
        onDelta(d);
        await new Promise((r) => setTimeout(r, 0));
      }
      clk.tick(gapMs);
      return { text };
    },
  };
}

describe("speakReply", () => {
  it("starts audio before the reply is complete and speaks in order without overlap", async () => {
    const clk = clock();
    const { tts, log, overlapped } = fakeTts(clk);
    const llm = streamingLlm(clk, ["Bom dia.", " O que", " vai ser?", " Diga, faz", " favor."]);
    const r = await speakReply({ llm, tts, now: clk.now }, req, { lang: "pt-PT" });
    expect(r.text).toBe("Bom dia. O que vai ser? Diga, faz favor.");
    expect(log.filter((l) => l.startsWith("start"))).toEqual([
      "start Bom dia.",
      "start O que vai ser?",
      "start Diga, faz favor.",
    ]);
    expect(overlapped()).toBe(false);
    // Each sentence ends before the next one starts.
    expect(log).toEqual([
      "start Bom dia.",
      "end Bom dia.",
      "start O que vai ser?",
      "end O que vai ser?",
      "start Diga, faz favor.",
      "end Diga, faz favor.",
    ]);
    const t = r.timings;
    expect(t.firstDeltaAt).not.toBeNull();
    expect(t.firstSentenceAt).not.toBeNull();
    expect(t.firstAudioStartAt).not.toBeNull();
    expect(t.firstAudioStartAt!).toBeLessThan(t.replyCompleteAt);
    expect(t.firstSentenceAt!).toBeLessThan(t.replyCompleteAt);
    expect(t.requestAt).toBeLessThanOrEqual(t.firstDeltaAt!);
    expect(t.audioEndAt).not.toBeNull();
  });

  it("passes lang, voice and rate to the tts and reports growing text", async () => {
    const clk = clock();
    const seen: unknown[] = [];
    const tts: TtsProvider = {
      kind: "tts",
      id: "f",
      label: "f",
      paid: false,
      async speak(_t, o) {
        seen.push([o.lang, o.voice, o.rate]);
      },
    };
    const llm = streamingLlm(clk, ["Olá.", " Sim."]);
    const texts: string[] = [];
    await speakReply({ llm, tts, now: clk.now }, req, {
      lang: "pt-PT",
      voice: "Joana",
      rate: 0.85,
      onText: (s) => texts.push(s),
    });
    expect(seen).toEqual([
      ["pt-PT", "Joana", 0.85],
      ["pt-PT", "Joana", 0.85],
    ]);
    expect(texts).toEqual(["Olá.", "Olá. Sim."]);
  });

  it("on a tts failure reports it, stops further audio and still returns the full text", async () => {
    const clk = clock();
    const { tts, log } = fakeTts(clk, { failOn: 1 });
    const errors: unknown[] = [];
    const llm = streamingLlm(clk, ["Bom dia.", " O que vai ser?", " Diga."]);
    const r = await speakReply({ llm, tts, now: clk.now }, req, {
      lang: "pt-PT",
      onTtsError: (e) => errors.push(e),
    });
    expect(r.text).toBe("Bom dia. O que vai ser? Diga.");
    expect(errors).toHaveLength(1);
    expect(log.filter((l) => l.startsWith("start"))).toEqual(["start Bom dia."]);
  });

  it("falls back to complete when the provider cannot stream", async () => {
    const clk = clock();
    const { tts, log } = fakeTts(clk);
    const llm: LlmProvider = {
      kind: "llm",
      id: "plain",
      label: "Plain",
      paid: false,
      async complete() {
        clk.tick(50);
        return { text: "Bom dia. Diga, faz favor." };
      },
    };
    const r = await speakReply({ llm, tts, now: clk.now }, req, { lang: "pt-PT" });
    expect(r.text).toBe("Bom dia. Diga, faz favor.");
    expect(log.filter((l) => l.startsWith("start"))).toEqual(["start Bom dia.", "start Diga, faz favor."]);
    expect(r.timings.firstDeltaAt).toBeNull();
    expect(r.timings.firstAudioStartAt).not.toBeNull();
  });

  it("stops speech and rejects when aborted", async () => {
    const clk = clock();
    const { tts, log } = fakeTts(clk);
    const ctl = new AbortController();
    const llm = streamingLlm(clk, ["Bom dia.", " O que vai ser?", " Diga."]);
    const p = speakReply({ llm, tts, now: clk.now }, req, {
      lang: "pt-PT",
      signal: ctl.signal,
      onText: () => ctl.abort(),
    });
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    expect(log.filter((l) => l.startsWith("start")).length).toBeLessThanOrEqual(1);
  });
});
