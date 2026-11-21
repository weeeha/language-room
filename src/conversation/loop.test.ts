import { describe, expect, it } from "vitest";
import type { LlmProvider, LlmRequest } from "../providers/llm";
import type { TtsProvider } from "../providers/tts";
import type { Scenario } from "../scenario/validate";
import { buildConfirmedTurn } from "../ui/HeardConfirm";
import { createConversation, type LoopEvent } from "./loop";
import { createMemoryStore, medianLatency, type Session, type SessionStore } from "./session";

const scenario = {
  id: "cafe",
  version: 3,
  title: "Cafe",
  language: { code: "pt-PT", name: "European Portuguese" },
  level: "A2",
  place: { name: "Pastelaria" },
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

const providerIds = { stt: "stt", llm: "llm", analyzer: "an", reviewer: "rev", tts: "tts" };

type ReplyScript = (req: LlmRequest, onDelta: (t: string) => void) => Promise<string>;

function turnOf(text: string, low: string[] = []) {
  const t = buildConfirmedTurn({ text, words: low.map((w) => ({ text: w, confidence: 0.1 })) }, null);
  if (!t) throw new Error("empty");
  return t;
}

function setup(
  opts: {
    reply?: ReplyScript;
    steps?: () => string;
    analyzer?: (line: string) => string | Promise<string>;
    reviewer?: (verdictFor: string) => string;
    tts?: "none" | "ok" | "fail";
    store?: SessionStore;
    replyTimeoutMs?: number;
  } = {},
) {
  let t = 1000;
  const clk = { now: () => t, tick: (ms: number) => void (t += ms) };
  const requests: LlmRequest[] = [];
  const checkerThinking: (boolean | undefined)[] = [];
  const defaultReply: ReplyScript = async (_req, onDelta) => {
    clk.tick(400);
    onDelta("Bom dia. ");
    onDelta("O que deseja?");
    return "Bom dia. O que deseja?";
  };
  const llm: LlmProvider = {
    kind: "llm",
    id: "llm",
    label: "Reply",
    paid: false,
    async complete(req) {
      requests.push(req);
      return { text: (opts.steps ?? (() => '{"done":[]}'))() };
    },
    async completeStream(req, onDelta) {
      requests.push(req);
      return { text: await (opts.reply ?? defaultReply)(req, onDelta) };
    },
  };
  const analyzer: LlmProvider = {
    kind: "llm",
    id: "an",
    label: "An",
    paid: false,
    async complete(req) {
      checkerThinking.push(req.thinking);
      const line = req.messages.at(-1)?.content.replace("Learner line: ", "") ?? "";
      return { text: await (opts.analyzer ?? (() => '{"issues":[]}'))(line) };
    },
  };
  const reviewer: LlmProvider = {
    kind: "llm",
    id: "rev",
    label: "Rev",
    paid: false,
    async complete(req) {
      checkerThinking.push(req.thinking);
      const claimed = /Claimed mistake: "([^"]*)"/.exec(req.messages.at(-1)?.content ?? "")?.[1] ?? "";
      return { text: (opts.reviewer ?? (() => '{"verdict":"correct","reason":"r"}'))(claimed) };
    },
  };
  const tts: TtsProvider = {
    kind: "tts",
    id: "tts",
    label: "Tts",
    paid: false,
    async speak() {
      if (opts.tts === "fail") throw new Error("speaker broke");
      clk.tick(50);
    },
  };
  const store = opts.store ?? createMemoryStore();
  let n = 0;
  const conv = createConversation(
    {
      llm,
      analyzer,
      reviewer,
      tts: opts.tts === "none" ? null : tts,
      store,
      providerIds,
      now: clk.now,
      makeId: () => `id-${++n}`,
      replyTimeoutMs: opts.replyTimeoutMs,
    },
    scenario,
    { lang: "pt-PT" },
  );
  const events: LoopEvent[] = [];
  conv.subscribe((e) => events.push(e));
  return { conv, clk, events, requests, store, checkerThinking };
}

const issueJson = (span: string) =>
  JSON.stringify({ issues: [{ span, type: "grammar", suggestion: span + "x", rule: "rule" }] });

describe("conversation loop", () => {
  it("answers a confirmed learner line with a character reply", async () => {
    const { conv, events } = setup();
    await conv.send(turnOf("Bom dia."));
    const turns = conv.session.turns;
    expect(turns.map((x) => x.role)).toEqual(["learner", "character"]);
    expect(turns[0]).toMatchObject({ text: "Bom dia.", heardText: "Bom dia.", confirmed: true });
    expect(turns[1]?.text).toBe("Bom dia. O que deseja?");
    expect(events.filter((e) => e.type === "state").map((e) => (e as { state: string }).state)).toEqual(["replying", "idle"]);
  });

  it("runs the reply with thinking off", async () => {
    const { conv, requests } = setup();
    await conv.send(turnOf("Bom dia."));
    const replyReq = requests.find((r) => r.messages[0]?.content.includes("You are Rui"));
    expect(replyReq?.thinking).toBe(false);
  });

  it("runs the analyzer and the reviewer with thinking on", async () => {
    const { conv, checkerThinking } = setup({ analyzer: () => issueJson("uma café") });
    await conv.send(turnOf("Queria uma café."));
    expect(checkerThinking).toEqual([true, true]);
  });

  it("runs the reply and the checker at the same time, each waiting for the other", async () => {
    let analyzerCalled!: () => void;
    let replyStarted!: () => void;
    const analyzerSeen = new Promise<void>((r) => (analyzerCalled = r));
    const replySeen = new Promise<void>((r) => (replyStarted = r));
    const { conv } = setup({
      reply: async (_req, onDelta) => {
        replyStarted();
        await analyzerSeen;
        onDelta("Bom dia.");
        return "Bom dia.";
      },
      analyzer: async () => {
        analyzerCalled();
        await replySeen;
        return '{"issues":[]}';
      },
    });
    await conv.send(turnOf("Bom dia."));
    expect(conv.session.turns).toHaveLength(2);
  });

  it("records turns, issues and latencies", async () => {
    const { conv } = setup({ analyzer: () => issueJson("uma café") });
    await conv.send(turnOf("Queria uma café."));
    const [learner, character] = conv.session.turns;
    expect(learner?.latencyMs).toBeUndefined();
    expect(character?.latencyMs).toBe(400);
    expect(character?.level).toMatchObject({ flagged: false });
    expect(character?.level?.averageWords).toBeGreaterThan(0);
    expect(conv.session.issues).toHaveLength(1);
    expect(conv.session.issues[0]).toMatchObject({ turnId: learner?.id, span: "uma café", verdict: "correct", shown: true });
    expect(medianLatency(conv.session)).toBe(400);
    expect(conv.session).toMatchObject({ scenarioId: "cafe", scenarioVersion: 3, providers: providerIds });
  });

  it("falls back to first text for the latency when there is no speech", async () => {
    const { conv } = setup({ tts: "none" });
    await conv.send(turnOf("Bom dia."));
    expect(conv.session.turns[1]?.latencyMs).toBe(400);
    expect(conv.session.turns[1]?.ttsFailed).toBeUndefined();
  });

  it("stores unsure and incorrect issues as not shown and emits all of them", async () => {
    const { conv, events } = setup({
      analyzer: () =>
        JSON.stringify({
          issues: [
            { span: "Bom", type: "grammar", suggestion: "Boa", rule: "a" },
            { span: "dia", type: "vocabulary", suggestion: "tarde", rule: "b" },
            { span: "Olá", type: "register", suggestion: "Oi", rule: "c" },
          ],
        }),
      reviewer: (span) =>
        span === "Bom" ? '{"verdict":"correct","reason":"r"}' : span === "dia" ? '{"verdict":"incorrect","reason":"r"}' : '{"verdict":"unsure","reason":"r"}',
    });
    await conv.send(turnOf("Olá Bom dia."));
    const bySpan = Object.fromEntries(conv.session.issues.map((i) => [i.span, i]));
    expect(bySpan["Bom"]?.shown).toBe(true);
    expect(bySpan["dia"]).toMatchObject({ verdict: "incorrect", shown: false });
    expect(bySpan["Olá"]).toMatchObject({ verdict: "unsure", shown: false });
    const ev = events.find((e) => e.type === "issues") as Extract<LoopEvent, { type: "issues" }>;
    expect(ev.issues).toHaveLength(3);
    expect(ev.turnId).toBe(conv.session.turns[0]?.id);
  });

  it("holds back issues on low-confidence words", async () => {
    const { conv } = setup({ analyzer: () => issueJson("café") });
    await conv.send(turnOf("Um café.", ["café"]));
    expect(conv.session.issues[0]).toMatchObject({ shown: false, held: "possibly-misheard" });
  });

  it("keeps the learner turn on a timeout and lets retry ask again", async () => {
    let calls = 0;
    const { conv, events } = setup({
      replyTimeoutMs: 20,
      reply: async (_req, onDelta) => {
        calls += 1;
        if (calls === 1) {
          onDelta("Bom");
          return new Promise<string>(() => undefined);
        }
        onDelta("Bom dia.");
        return "Bom dia.";
      },
    });
    await conv.send(turnOf("Bom dia."));
    expect(conv.session.turns.map((x) => x.role)).toEqual(["learner"]);
    const grown = events.find((e) => e.type === "turn" && e.turn.role === "character");
    expect(grown).toBeDefined();
    expect(events).toContainEqual({
      type: "turn-removed",
      turnId: grown && grown.type === "turn" ? grown.turn.id : "missing",
    });
    expect(events).toContainEqual(expect.objectContaining({ type: "error", where: "reply", retryable: true }));
    expect(events.at(-1)).toEqual({ type: "state", state: "idle" });
    await conv.retry();
    expect(conv.session.turns.map((x) => x.role)).toEqual(["learner", "character"]);
    expect(conv.session.turns[1]?.text).toBe("Bom dia.");
    await conv.retry();
    expect(calls).toBe(2);
  });

  it("keeps the learner turn when the reply throws", async () => {
    const { conv, events } = setup({
      reply: async () => {
        throw new Error("model down");
      },
    });
    await conv.send(turnOf("Bom dia."));
    expect(conv.session.turns).toHaveLength(1);
    expect(events).toContainEqual({ type: "error", where: "reply", message: "model down", retryable: true });
  });

  it("ends with reason goal when every step is done, after the reply finished", async () => {
    const { conv, events } = setup({ steps: () => '{"done":["greet","order","pay"]}' });
    await conv.send(turnOf("A conta, por favor."));
    expect(conv.session.turns).toHaveLength(2);
    expect(conv.session.stepsDone).toEqual(["greet", "order", "pay"]);
    expect(conv.session.endReason).toBe("goal");
    expect(typeof conv.session.endedAt).toBe("number");
    expect(events.at(-1)).toEqual({ type: "state", state: "ended" });
    expect(events).toContainEqual({ type: "steps", stepsDone: ["greet", "order", "pay"] });
    const count = conv.session.turns.length;
    await conv.send(turnOf("Mais um."));
    await conv.retry();
    await conv.nudge();
    expect(conv.session.turns).toHaveLength(count);
  });

  it("does not end when only some steps are done", async () => {
    const { conv } = setup({ steps: () => '{"done":["greet"]}' });
    await conv.send(turnOf("Bom dia."));
    expect(conv.session.stepsDone).toEqual(["greet"]);
    expect(conv.session.endReason).toBeUndefined();
  });

  it("ends at once on end(learner) while a reply is pending", async () => {
    let started!: () => void;
    const began = new Promise<void>((r) => (started = r));
    const { conv, events } = setup({
      reply: (req) =>
        new Promise<string>((_resolve, reject) => {
          started();
          req.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    });
    const sending = conv.send(turnOf("Bom dia."));
    await began;
    await conv.end("learner");
    await sending;
    expect(conv.session.endReason).toBe("learner");
    expect(conv.session.turns.map((x) => x.role)).toEqual(["learner"]);
    expect(events.some((e) => e.type === "error")).toBe(false);
    expect(events.at(-1)).toEqual({ type: "state", state: "ended" });
    await conv.send(turnOf("Ainda aqui."));
    expect(conv.session.turns).toHaveLength(1);
  });

  it("still replies when the corrections fail", async () => {
    const { conv, events } = setup({
      analyzer: () => {
        throw new Error("checker down");
      },
    });
    await conv.send(turnOf("Bom dia."));
    expect(conv.session.turns).toHaveLength(2);
    expect(conv.session.issues).toEqual([]);
    expect(events).toContainEqual({ type: "error", where: "corrections", message: "checker down", retryable: false });
    expect(events.some((e) => e.type === "issues")).toBe(false);
  });

  it("keeps the text when speech fails", async () => {
    const { conv, events } = setup({ tts: "fail" });
    await conv.send(turnOf("Bom dia."));
    expect(conv.session.turns[1]).toMatchObject({ text: "Bom dia. O que deseja?", ttsFailed: true });
    expect(events).toContainEqual(expect.objectContaining({ type: "error", where: "tts", retryable: false }));
    expect(conv.session.turns[1]?.latencyMs).toBe(400);
  });

  it("saves the final session and survives a failing store", async () => {
    const saved: Session[] = [];
    let failing = false;
    const store: SessionStore = {
      async save(s) {
        if (failing) throw new Error("disk full");
        saved.push(structuredClone(s));
      },
      get: async () => undefined,
      list: async () => [],
    };
    const { conv } = setup({ store, steps: () => '{"done":["greet","order","pay"]}' });
    await conv.send(turnOf("A conta, por favor."));
    const last = saved.at(-1);
    expect(last?.endReason).toBe("goal");
    expect(last?.turns).toHaveLength(2);
    expect(last?.stepsDone).toHaveLength(3);

    failing = true;
    const second = setup({ store });
    await second.conv.send(turnOf("Bom dia."));
    expect(second.conv.session.turns).toHaveLength(2);
    expect(second.conv.session.errors.some((e) => e.where === "store" && e.message === "disk full")).toBe(true);
  });

  it("ignores a second send while a reply is pending", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let calls = 0;
    const { conv } = setup({
      reply: async (_req, onDelta) => {
        calls += 1;
        await gate;
        onDelta("Bom dia.");
        return "Bom dia.";
      },
    });
    const first = conv.send(turnOf("Um."));
    await Promise.resolve();
    await conv.send(turnOf("Dois."));
    release();
    await first;
    expect(calls).toBe(1);
    expect(conv.session.turns.filter((x) => x.role === "learner").map((x) => x.text)).toEqual(["Um."]);
  });

  it("greets on start and nudges with the silence prompt", async () => {
    const { conv, requests } = setup();
    await conv.start();
    expect(conv.session.turns.map((x) => x.role)).toEqual(["character"]);
    expect(requests[0]?.messages.at(-1)?.content).toContain("Greet");
    await conv.nudge();
    expect(conv.session.turns.map((x) => x.role)).toEqual(["character", "character"]);
    expect(requests.at(-1)?.messages.at(-1)?.content).toContain("said nothing for 20 seconds");
  });

  it("marks a character line as reported", async () => {
    const { conv } = setup();
    await conv.send(turnOf("Bom dia."));
    const id = conv.session.turns[1]!.id;
    conv.report(id);
    expect(conv.session.turns[1]?.reported).toBe(true);
    conv.report("missing");
  });

  it("stops sending events after unsubscribe", async () => {
    const { conv } = setup();
    const seen: LoopEvent[] = [];
    const off = conv.subscribe((e) => seen.push(e));
    off();
    await conv.send(turnOf("Bom dia."));
    expect(seen).toEqual([]);
  });
});
