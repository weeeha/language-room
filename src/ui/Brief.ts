// Brief screen (port of draft/brief.html), with a real microphone check.
import type { SttProvider } from "../providers/stt";
import type { Scenario } from "../scenario/validate";
import { audioNotice, briefContent, classifyMicError, MIC_PROBLEM_COPY, type MicProblem } from "./briefContent";
import { h, icon, lang, notice, setIcon, signageNotice } from "./dom";
import { paths } from "./routes";
import type { Screen } from "./router";
import { loadRuntime } from "./runtime";

export const UNREVIEWED_NOTICE = "This scenario is not yet reviewed by a fluent speaker.";
const CHECKING = "Checking your microphone.";
const AUTO_STOP_MS = 8_000;

export async function createBrief(scenario: Scenario, listed: boolean): Promise<Screen> {
  const c = briefContent(scenario);
  const { providers } = await loadRuntime();
  const stt: SttProvider | undefined = providers.stt[0];
  const code = c.langCode;
  const sample = scenario.targets.phrases[0] ?? "Bom dia";

  const facts = h(
    "dl",
    { class: "facts" },
    h("div", {}, h("dt", {}, "Place"), h("dd", {}, c.place)),
    h("div", {}, h("dt", {}, "Character"), h("dd", {}, c.character)),
    h("div", {}, h("dt", {}, "Level"), h("dd", {}, c.level)),
    h("div", {}, h("dt", {}, "Goal"), h("dd", {}, c.goal)),
    h("div", {}, h("dt", {}, "Steps"), h("dd", {}, h("ol", {}, ...c.steps.map((s) => h("li", {}, s))))),
  );

  const words = h(
    "table",
    { class: "words" },
    h("thead", {}, h("tr", {}, h("th", { scope: "col" }, c.languageHeading), h("th", { scope: "col" }, "English"))),
    h(
      "tbody",
      {},
      ...c.words.map((w) => {
        const pt = h("td", {});
        pt.lang = code;
        pt.textContent = w.portuguese;
        return h("tr", {}, pt, h("td", {}, w.gloss ?? ""));
      }),
    ),
  );

  // Microphone check.
  const testLabel = h("span", { id: "test-label" }, "Test microphone");
  const testIcon = icon("mic");
  const testBtn = h("button", { class: "btn", type: "button", "aria-labelledby": "test-label" }, testIcon, testLabel);
  const status = h("p", { class: "status", role: "status" });
  const problemSlot = h("div", {});
  let running: { stop(): void } | null = null;

  function idleButton(): void {
    testLabel.textContent = "Test microphone";
    setIcon(testIcon, "mic");
  }
  function showProblem(p: Exclude<MicProblem, "aborted">): void {
    const copy = MIC_PROBLEM_COPY[p];
    problemSlot.replaceChildren(
      notice(copy.text, {
        error: true,
        action: copy.action ? { label: copy.action, onClick: () => void check() } : undefined,
      }),
    );
  }

  async function check(): Promise<void> {
    if (running) {
      running.stop();
      return;
    }
    if (!stt) {
      showProblem("unreachable");
      return;
    }
    problemSlot.replaceChildren();
    status.replaceChildren(CHECKING);
    testLabel.textContent = "Stop test";
    setIcon(testIcon, "stop");
    const ctl = new AbortController();
    let stopRequested = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const handle = {
      stop() {
        stopRequested = true;
        if (stt.stop) stt.stop();
        else ctl.abort();
      },
    };
    running = handle;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        const err = new Error("No microphone interface");
        err.name = "NotFoundError";
        throw err;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      if (stopRequested) throw new DOMException("Stopped before listening", "AbortError");
      timer = setTimeout(() => handle.stop(), AUTO_STOP_MS);
      const heard = await stt.listenOnce({ lang: code, signal: ctl.signal });
      status.replaceChildren("Microphone works. We heard: ", lang(code, heard.text), ".");
    } catch (e) {
      const problem = classifyMicError(e);
      if (problem === "aborted") status.replaceChildren();
      else {
        status.replaceChildren();
        showProblem(problem);
      }
    } finally {
      clearTimeout(timer);
      running = null;
      idleButton();
    }
  }
  testBtn.addEventListener("click", () => void check());

  const checkText = h("p", {}, 'Press the microphone button and say "', lang(code, sample), '". Your words appear below the button. Check that they match what you said.');

  const col = h("div", { class: "text-col" });
  if (!listed) col.append(notice(UNREVIEWED_NOTICE));
  col.append(
    h("h1", {}, c.title),
    facts,
    h("h2", {}, "Useful words"),
    words,
    h("h2", {}, "Check your microphone"),
    checkText,
    h("p", { class: "muted" }, stt ? audioNotice(stt) : ""),
    h("div", { class: "mic-row" }, testBtn),
    status,
    problemSlot,
    signageNotice(),
    h("p", { class: "muted" }, "The check is optional."),
    h("p", {}, h("a", { class: "btn btn-primary", href: paths.play(scenario.id) }, "Start conversation")),
    h("p", {}, h("a", { class: "tap", href: paths.library() }, "Back to library")),
  );

  return {
    title: c.title,
    element: col,
    dispose() {
      running?.stop();
    },
  };
}
