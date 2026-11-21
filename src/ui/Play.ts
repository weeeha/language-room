// Conversation page: builds the providers, the loop and the panel, and wires them together.
import { createConversation, type LoopEvent } from "../conversation/loop";
import { medianLatency } from "../conversation/session";
import type { LlmProvider } from "../providers/llm";
import type { SttProvider } from "../providers/stt";
import type { TtsProvider } from "../providers/tts";
import type { Scenario } from "../scenario/validate";
import { classifyMicError, MIC_PROBLEM_COPY } from "./briefContent";
import { createConversationPanel, type PanelHandle } from "./ConversationPanel";
import { createDebugFooter, type CallCounts, type Kind } from "./DebugFooter";
import { mountScene, type MountedScene } from "../scene/mount";
import { notice } from "./dom";
import { buildConfirmedTurn, createHeardConfirm, type ConfirmedTurn } from "./HeardConfirm";
import { bindSpaceBar, createMic } from "./Mic";
import { paths } from "./routes";
import type { Screen } from "./router";
import { getStore, loadRuntime } from "./runtime";
import { createSilenceMachine, currentHint } from "./silence";
import { checkSelectable, switchable } from "./switchable";

const MEDIAN_AFTER_TURNS = 10;

export async function createPlay(scenario: Scenario): Promise<Screen> {
  const { providers, paidProviders } = await loadRuntime();
  const code = scenario.language.code;
  const name = scenario.character.name;

  // The first provider of each kind is the free one. The footer pickers can change it.
  const current: { stt: SttProvider; llm: LlmProvider; tts: TtsProvider } = {
    stt: providers.stt[0] as SttProvider,
    llm: providers.llm[0] as LlmProvider,
    tts: providers.tts[0] as TtsProvider,
  };
  const counts: CallCounts = { llm: 0, stt: 0, tts: 0 };
  let refreshFooter: () => void = () => undefined;
  let speakingDepth = 0;
  const ui: { panel?: PanelHandle } = {};

  const count = (kind: keyof CallCounts) => (call: () => unknown) => {
    counts[kind] += 1;
    refreshFooter();
    return call();
  };
  const llm = switchable(() => current.llm, { complete: count("llm"), completeStream: count("llm") });
  const stt = switchable(() => current.stt, { listenOnce: count("stt") });
  const tts = switchable(() => current.tts, {
    speak: (call) => {
      counts.tts += 1;
      speakingDepth += 1;
      ui.panel?.setSpeaking(true);
      refreshFooter();
      const done = (): void => {
        speakingDepth -= 1;
        if (speakingDepth <= 0) ui.panel?.setSpeaking(false);
      };
      return (call() as Promise<unknown>).finally(done);
    },
  });

  const conversation = createConversation(
    {
      llm,
      analyzer: llm,
      reviewer: llm,
      tts,
      store: getStore(),
      providerIds: { stt: current.stt.id, llm: current.llm.id, analyzer: current.llm.id, reviewer: current.llm.id, tts: current.tts.id },
    },
    scenario,
    { lang: code, voice: scenario.character.voice?.tts, rate: scenario.character.voice?.rate },
  );

  let disposed = false;
  let ended = false;
  let nudging = false;
  let listening = false;
  let listenCtl: AbortController | undefined;
  let panelBusy = false;

  const silence = createSilenceMachine({ onNudge: () => void nudge() });

  const panel = createConversationPanel(scenario, {
    onReport: (id) => conversation.report(id),
    onTypedSend(text) {
      const turn = buildConfirmedTurn({ text }, null);
      if (turn) submit(turn);
    },
    onTypedActivity(hasText) {
      if (hasText) silence.activity();
      else silence.idle();
    },
    onEnd: () => void conversation.end("learner"),
  });
  ui.panel = panel;

  function submit(turn: ConfirmedTurn): void {
    panel.setNotice(null);
    silence.learnerSent();
    mic.setFilled(true);
    void conversation.send(turn);
  }

  const confirm = createHeardConfirm({
    lang: code,
    onConfirm: submit,
    onCancel() {
      mic.setFilled(true);
      silence.idle();
    },
  });
  panel.confirmSlot.append(confirm.element);

  const mic = createMic({ onToggle: () => void toggleMic() });
  panel.micSlot.append(mic.element);

  function showProblem(problem: Exclude<ReturnType<typeof classifyMicError>, "aborted">): void {
    const copy = MIC_PROBLEM_COPY[problem];
    panel.setNotice(
      notice(copy.text, {
        error: true,
        action: copy.action ? { label: copy.action, onClick: () => void toggleMic() } : undefined,
      }),
    );
  }

  async function toggleMic(): Promise<void> {
    if (ended || disposed) return;
    if (listening) {
      // Ask the provider to finish what it heard. Providers without stop are cancelled.
      mic.setListening(false);
      mic.setDisabled(true);
      if (current.stt.stop) current.stt.stop();
      else listenCtl?.abort();
      return;
    }
    if (panelBusy) return;
    if (confirm.isOpen()) confirm.clear();
    panel.setNotice(null);
    listening = true;
    mic.setListening(true);
    silence.activity();
    const ctl = new AbortController();
    listenCtl = ctl;
    try {
      const heard = await stt.listenOnce({ lang: code, signal: ctl.signal });
      if (ended || disposed) return;
      mic.setFilled(false);
      confirm.show(heard);
    } catch (e) {
      const problem = classifyMicError(e);
      if (problem !== "aborted") showProblem(problem);
      silence.idle();
    } finally {
      listening = false;
      listenCtl = undefined;
      mic.setListening(false);
      mic.setDisabled(panelBusy || ended);
    }
  }

  function setBusy(on: boolean): void {
    panelBusy = on;
    panel.setBusy(on);
    mic.setDisabled(on || ended || listening);
    if (on && listening) listenCtl?.abort();
  }

  async function nudge(): Promise<void> {
    if (ended || disposed) return;
    nudging = true;
    panel.setNotice(null);
    try {
      await conversation.nudge();
    } finally {
      nudging = false;
    }
    const last = conversation.session.turns.at(-1);
    if (!last || last.role !== "character") return;
    const hint = currentHint(scenario.goal.steps, conversation.session.stepsDone);
    if (hint) panel.setHint(last.id, hint);
  }

  // Latency log (brief step 5): each turn, then the median after 10 learner turns.
  const logged = new Set<string>();
  function logLatency(turnId: string, ms: number): void {
    if (logged.has(turnId)) return;
    logged.add(turnId);
    console.info("latency", { turnId, ms: Math.round(ms), llm: current.llm.id, tts: current.tts.id, turn: logged.size });
    if (logged.size === MEDIAN_AFTER_TURNS) {
      const median = medianLatency(conversation.session);
      console.info("median latency over 10 turns", { ms: median === null ? null : Math.round(median) });
    }
  }

  function retry(): void {
    panel.setNotice(null);
    if (conversation.session.turns.length === 0) void conversation.start();
    else void conversation.retry();
  }

  function onEvent(e: LoopEvent): void {
    if (disposed) return;
    switch (e.type) {
      case "turn":
        panel.applyTurn(e.turn);
        if (e.turn.role === "character" && e.turn.latencyMs !== undefined) logLatency(e.turn.id, e.turn.latencyMs);
        break;
      case "turn-removed":
        panel.removeTurn(e.turnId);
        break;
      case "issues":
        panel.applyIssues(e.turnId, e.issues);
        break;
      case "steps":
        panel.setSteps(e.stepsDone);
        break;
      case "state":
        if (e.state === "replying") {
          panel.setNotice(null);
          setBusy(true);
        } else if (e.state === "idle") {
          setBusy(false);
          if (conversation.session.turns.at(-1)?.role === "character") silence.characterFinished();
        } else {
          onEnded();
        }
        break;
      case "error":
        if (e.where === "reply") {
          if (nudging) break;
          panel.setNotice(
            notice(`${name} did not answer in time. Your line is kept.`, {
              error: true,
              action: { label: "Retry", onClick: retry },
            }),
          );
        } else if (e.where === "tts") {
          panel.setNotice(notice("Audio is unavailable for this line. Showing text only."));
        } else {
          console.warn(`${e.where} failed`, e.message);
        }
        break;
    }
    refreshFooter();
  }

  function onEnded(): void {
    ended = true;
    silence.end();
    listenCtl?.abort();
    confirm.clear();
    const s = conversation.session;
    panel.setEnded({
      reason: s.endReason === "goal" ? "You finished every goal step." : "You ended the conversation.",
      recapHref: paths.recap(scenario.id, s.id),
      libraryHref: paths.library(),
    });
  }

  const unsubscribe = conversation.subscribe(onEvent);

  // Debug footer with provider pickers (docs/spec.md sections 5.11 and 6, criterion 13).
  const footer = createDebugFooter({
    providers,
    selected: { stt: current.stt.id, llm: current.llm.id, tts: current.tts.id },
    onSelect(kind: Kind, id: string) {
      const list = providers[kind];
      const next = list.find((p) => p.id === id);
      if (!next) return null;
      const result = checkSelectable(next, paidProviders);
      if (!result.ok) return result.message;
      (current as Record<Kind, unknown>)[kind] = next;
      return null;
    },
  });
  panel.footerSlot.append(footer.element);
  refreshFooter = () => footer.update({ counts: { ...counts }, median: medianLatency(conversation.session) });
  refreshFooter();

  const unbindSpace = bindSpaceBar(() => {
    if (!ended && !disposed) void toggleMic();
  });

  // The conversation starts first. The scene mounts after it and can fail on its own.
  let sceneView: MountedScene | undefined;
  const startTimer = setTimeout(() => {
    if (disposed) return;
    void conversation.start();
    try {
      const query = new URLSearchParams(location.search);
      const sample = import.meta.env.DEV && query.get("scene") === "sample";
      const place = import.meta.env.DEV && query.get("place") === "1";
      sceneView = mountScene(panel.sceneRoot, scenario, { sample, place });
    } catch (e) {
      console.warn("scene mount failed", e);
    }
  }, 0);

  return {
    title: "Conversation",
    rootClass: "play",
    element: panel.element,
    dispose() {
      disposed = true;
      clearTimeout(startTimer);
      unsubscribe();
      unbindSpace();
      silence.end();
      listenCtl?.abort();
      sceneView?.dispose();
      (globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis?.cancel();
    },
  };
}
