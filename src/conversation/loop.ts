// The conversation loop (docs/spec.md sections 5.5 and 5.6).
// A learner line starts three jobs at once: the character reply, the correction check and the
// steps judge. The reply never waits for the checker and never contains corrections.
import type { LlmMessage, LlmProvider } from "../providers/llm";
import type { TtsProvider } from "../providers/tts";
import type { Scenario } from "../scenario/validate";
import type { ConfirmedTurn } from "../ui/HeardConfirm";
import { checkLine, type Issue } from "./corrections";
import { checkLevel } from "./level";
import { buildCharacterMessages, buildSilencePrompt, type PromptTurn } from "./prompt";
import type { Session, SessionStore, Turn } from "./session";
import { speakReply } from "./speak";
import { judgeSteps } from "./steps";

export type LoopEvent =
  | { type: "turn"; turn: Turn }
  | { type: "issues"; turnId: string; issues: Issue[] }
  | { type: "steps"; stepsDone: string[] }
  | { type: "state"; state: "idle" | "replying" | "ended" }
  | { type: "error"; where: "reply" | "corrections" | "tts" | "steps"; message: string; retryable: boolean };

export interface Conversation {
  readonly session: Session;
  start(): Promise<void>;
  send(turn: ConfirmedTurn): Promise<void>;
  retry(): Promise<void>;
  nudge(): Promise<void>;
  report(turnId: string): void;
  end(reason: "learner"): Promise<void>;
  subscribe(fn: (e: LoopEvent) => void): () => void;
}

export interface ConversationDeps {
  llm: LlmProvider;
  analyzer: LlmProvider;
  reviewer: LlmProvider;
  tts: TtsProvider | null;
  store: SessionStore;
  providerIds: Session["providers"];
  now?: () => number;
  makeId?: () => string;
  replyTimeoutMs?: number;
}

const DEFAULT_REPLY_TIMEOUT_MS = 20_000;
const REPLY_MAX_TOKENS = 160;
const REPLY_TEMPERATURE = 0.7;

const silentTts: TtsProvider = {
  kind: "tts",
  id: "none",
  label: "No speech",
  paid: false,
  async speak() {
    // Text-only mode: nothing to play.
  },
};

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function createConversation(
  deps: ConversationDeps,
  scenario: Scenario,
  speech: { lang: string; voice?: string; rate?: number },
): Conversation {
  const now = deps.now ?? (() => Date.now());
  const makeId = deps.makeId ?? (() => crypto.randomUUID());
  const replyTimeoutMs = deps.replyTimeoutMs ?? DEFAULT_REPLY_TIMEOUT_MS;

  const session: Session = {
    id: makeId(),
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
    startedAt: now(),
    turns: [],
    issues: [],
    stepsDone: [],
    providers: { ...deps.providerIds },
    errors: [],
  };

  const listeners = new Set<(e: LoopEvent) => void>();
  const emit = (e: LoopEvent): void => {
    for (const fn of [...listeners]) {
      try {
        fn(e);
      } catch {
        // A failing listener must not break the conversation.
      }
    }
  };

  let saveChain: Promise<void> = Promise.resolve();
  function persist(): Promise<void> {
    saveChain = saveChain.then(async () => {
      try {
        await deps.store.save(session);
      } catch (e) {
        session.errors.push({ at: now(), where: "store", message: messageOf(e) });
      }
    });
    return saveChain;
  }

  function fail(where: "reply" | "corrections" | "tts" | "steps", message: string, retryable: boolean): void {
    session.errors.push({ at: now(), where, message });
    emit({ type: "error", where, message, retryable });
  }

  let replying = false;
  let ended = false;
  let needsRetry = false;
  let goalReached = false;
  let runCounter = 0;
  const lifetime = new AbortController();

  function history(): PromptTurn[] {
    return session.turns.map((t) => ({ role: t.role, text: t.text }));
  }

  async function finish(reason: "goal" | "learner"): Promise<void> {
    if (ended) return;
    ended = true;
    session.endedAt = now();
    session.endReason = reason;
    if (reason === "learner") lifetime.abort();
    runCounter += 1;
    emit({ type: "state", state: "ended" });
    await persist();
  }

  async function maybeFinishGoal(): Promise<void> {
    if (goalReached && !replying && !ended) await finish("goal");
  }

  /** Asks the character for one line and shows it as it grows. Returns when the line is done or failed. */
  async function reply(messages: LlmMessage[], withLatency: boolean): Promise<void> {
    replying = true;
    emit({ type: "state", state: "replying" });
    const startedAt = now();
    const run = ++runCounter;
    const live = (): boolean => run === runCounter && !ended;
    const ctl = new AbortController();
    const onLifetimeAbort = (): void => ctl.abort();
    lifetime.signal.addEventListener("abort", onLifetimeAbort, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        ctl.abort();
        reject(new Error("The character took too long to answer"));
      }, replyTimeoutMs);
    });

    let characterTurn: Turn | undefined;
    let firstTextAt: number | null = null;
    let ttsFailed = false;
    const dropPartial = (): void => {
      if (characterTurn) {
        const i = session.turns.indexOf(characterTurn);
        if (i !== -1) session.turns.splice(i, 1);
      }
    };

    try {
      const speaking = speakReply(
        { llm: deps.llm, tts: deps.tts ?? silentTts, now },
        { messages, temperature: REPLY_TEMPERATURE, maxTokens: REPLY_MAX_TOKENS, thinking: false, signal: ctl.signal },
        {
          lang: speech.lang,
          voice: speech.voice,
          rate: speech.rate,
          signal: ctl.signal,
          onText: (soFar) => {
            if (!live()) return;
            if (!characterTurn) {
              firstTextAt = now();
              characterTurn = { id: makeId(), role: "character", text: soFar, at: firstTextAt };
              session.turns.push(characterTurn);
            } else {
              characterTurn.text = soFar;
            }
            emit({ type: "turn", turn: { ...characterTurn } });
          },
          onTtsError: (e) => {
            if (!live()) return;
            ttsFailed = true;
            fail("tts", messageOf(e), false);
          },
        },
      );
      speaking.catch(() => undefined);
      const result = await Promise.race([speaking, timeout]);
      if (!live()) return;
      const turn: Turn = characterTurn ?? { id: makeId(), role: "character", text: result.text, at: now() };
      if (!characterTurn) session.turns.push(turn);
      turn.text = result.text;
      const spokenAt = deps.tts && !ttsFailed ? result.timings.firstAudioStartAt : null;
      const first = spokenAt ?? firstTextAt ?? result.timings.replyCompleteAt;
      if (withLatency) turn.latencyMs = first - startedAt;
      const lvl = checkLevel(result.text, scenario.level);
      turn.level = { averageWords: lvl.averageWords, flagged: lvl.flagged };
      if (ttsFailed) turn.ttsFailed = true;
      needsRetry = false;
      emit({ type: "turn", turn: { ...turn } });
      await persist();
    } catch (e) {
      ctl.abort();
      if (!live()) return;
      dropPartial();
      needsRetry = withLatency;
      fail("reply", messageOf(e), true);
      await persist();
    } finally {
      clearTimeout(timer);
      lifetime.signal.removeEventListener("abort", onLifetimeAbort);
      if (run === runCounter) {
        replying = false;
        if (!ended) emit({ type: "state", state: "idle" });
      }
    }
    await maybeFinishGoal();
  }

  async function runCorrections(turn: Turn, lowConfidenceWords: string[]): Promise<void> {
    try {
      const issues = await checkLine(
        { analyzer: deps.analyzer, reviewer: deps.reviewer },
        { line: turn.text, turnId: turn.id, scenario, lowConfidenceWords, signal: lifetime.signal },
      );
      if (ended && session.endReason === "learner") return;
      session.issues.push(...issues);
      emit({ type: "issues", turnId: turn.id, issues: issues.map((i) => ({ ...i })) });
      await persist();
    } catch (e) {
      if (lifetime.signal.aborted) return;
      fail("corrections", messageOf(e), false);
    }
  }

  async function runSteps(): Promise<void> {
    const before = [...session.stepsDone];
    const updated = await judgeSteps(deps.llm, {
      scenario,
      history: history(),
      stepsDone: before,
      signal: lifetime.signal,
      onError: (message) => {
        if (!lifetime.signal.aborted) fail("steps", message, false);
      },
    });
    if (ended && session.endReason === "learner") return;
    const changed = updated.length !== before.length || updated.some((id, i) => id !== before[i]);
    if (changed) {
      session.stepsDone = updated;
      emit({ type: "steps", stepsDone: [...updated] });
      await persist();
    }
    if (scenario.goal.steps.length > 0 && scenario.goal.steps.every((s) => updated.includes(s.id))) {
      goalReached = true;
    }
    await maybeFinishGoal();
  }

  function stepsOpts() {
    return { stepsDone: session.stepsDone };
  }

  return {
    session,

    async start() {
      if (ended || replying || session.turns.length > 0) return;
      const messages = buildCharacterMessages(scenario, [], stepsOpts());
      messages.push({
        role: "user",
        content: `Greet the customer with one short line in ${scenario.language.name} and wait for their answer.`,
      });
      await reply(messages, false);
    },

    async send(confirmed) {
      if (ended || replying) return;
      const learner: Turn = {
        id: makeId(),
        role: "learner",
        text: confirmed.text,
        heardText: confirmed.heardText,
        confirmed: true,
        at: now(),
      };
      session.turns.push(learner);
      needsRetry = false;
      emit({ type: "turn", turn: { ...learner } });
      const messages = buildCharacterMessages(scenario, history(), stepsOpts());
      replying = true;
      await Promise.all([
        reply(messages, true),
        runCorrections(learner, [...confirmed.lowConfidenceWords]),
        runSteps(),
        persist(),
      ]);
    },

    async retry() {
      if (ended || replying || !needsRetry) return;
      await reply(buildCharacterMessages(scenario, history(), stepsOpts()), true);
    },

    async nudge() {
      if (ended || replying) return;
      await reply(buildSilencePrompt(scenario, stepsOpts()), false);
    },

    report(turnId) {
      const turn = session.turns.find((t) => t.id === turnId && t.role === "character");
      if (!turn) return;
      turn.reported = true;
      void persist();
    },

    async end(reason) {
      await finish(reason);
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
  };
}
