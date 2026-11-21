// The conversation panel (port of the panel in draft/scene.html). It draws what the loop reports.
// The scene area is a separate empty element (#scene-root) that phase 3 fills.
import type { Issue } from "../conversation/corrections";
import type { Turn } from "../conversation/session";
import type { Scenario } from "../scenario/validate";
import { UNREVIEWED_WARNING } from "../author/review";
import { chipsFor } from "./chips";
import { h, icon, notice, signageNotice } from "./dom";

export interface PanelCallbacks {
  onReport(turnId: string): void;
  onTypedSend(text: string): void;
  /** The learner started or stopped typing. hasText is false once the field is empty. */
  onTypedActivity(hasText: boolean): void;
  onEnd(): void;
}

export interface PanelHandle {
  element: HTMLElement;
  /** Empty and hidden. The scene viewer arrives in phase 3. */
  sceneRoot: HTMLElement;
  confirmSlot: HTMLElement;
  micSlot: HTMLElement;
  footerSlot: HTMLElement;
  applyTurn(turn: Turn): void;
  removeTurn(turnId: string): void;
  applyIssues(turnId: string, issues: readonly Issue[]): void;
  setHint(turnId: string, text: string): void;
  setSpeaking(on: boolean): void;
  setSteps(done: readonly string[]): void;
  setNotice(node: Node | null): void;
  setBusy(on: boolean): void;
  setEnded(info: { reason: string; recapHref: string; libraryHref: string }): void;
  readonly inputsDisabled: boolean;
}

interface Row {
  li: HTMLLIElement;
  say: HTMLElement;
  chips?: HTMLElement;
  report?: HTMLElement;
}

export function createConversationPanel(scenario: Scenario, cb: PanelCallbacks): PanelHandle {
  const code = scenario.language.code;
  const name = scenario.character.name;
  const rows = new Map<string, Row>();
  let chipCounter = 0;
  let busy = false;

  const transcript = h("ol", { class: "transcript", "aria-label": "Transcript", "aria-live": "polite", "aria-relevant": "additions" });
  const empty = h("p", { class: "empty-line" }, `${name} is about to speak.`);
  const speaking = h("p", { class: "speaking" }, icon("speaker"), "Speaking");
  speaking.hidden = true;
  const noticeSlot = h("div", {});
  const confirmSlot = h("div", {});
  const micSlot = h("div", {});

  // Typed line: its own Send is the confirmation.
  const input = h("input", { type: "text", id: "typed-line", autocomplete: "off", spellcheck: "false" });
  input.lang = code;
  const sendBtn = h("button", { class: "btn", type: "submit" }, "Send");
  const typed = h("form", { class: "typed" }, h("label", { for: "typed-line" }, "Type your line"), input, sendBtn);
  function refreshSend(): void {
    sendBtn.disabled = busy || input.value.trim() === "";
  }
  input.addEventListener("input", () => {
    cb.onTypedActivity(input.value.trim() !== "");
    refreshSend();
  });
  typed.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;
    input.value = "";
    refreshSend();
    cb.onTypedSend(text);
  });
  refreshSend();

  // Goal steps.
  const stepList = h("ol", { class: "steps" });
  function setSteps(done: readonly string[]): void {
    stepList.replaceChildren(
      ...scenario.goal.steps.map((s) => {
        const isDone = done.includes(s.id);
        return h(
          "li",
          {},
          icon(isDone ? "check" : "circle"),
          h("span", { class: "sr-only" }, isDone ? "Done: " : "Not done: "),
          h("span", {}, s.hint),
        );
      }),
    );
  }
  setSteps([]);

  const endBtn = h("button", { class: "btn", type: "button" }, "End conversation");
  endBtn.addEventListener("click", () => cb.onEnd());
  const endRow = h("div", { class: "actions" }, endBtn);
  const inputs = h("div", {}, confirmSlot, typed, micSlot);
  const endedSlot = h("div", {});
  const footerSlot = h("div", {});

  const sceneRoot = h("section", { class: "scene", id: "scene-root", "aria-label": "Scene" });
  sceneRoot.hidden = true;

  const panel = h(
    "div",
    { class: "panel conversation" },
    h("h1", {}, scenario.title),
    scenario.reviewed ? null : notice(UNREVIEWED_WARNING),
    h("h2", {}, "Conversation"),
    empty,
    transcript,
    speaking,
    noticeSlot,
    inputs,
    h("h2", {}, "Goal"),
    stepList,
    signageNotice(),
    endRow,
    endedSlot,
    footerSlot,
  );
  const element = h("div", { class: "scene-layout" }, sceneRoot, panel);

  function scrollToNewest(): void {
    transcript.lastElementChild?.scrollIntoView({ block: "nearest" });
  }

  function makeRow(turn: Turn): Row {
    const li = h("li", { class: turn.role === "character" ? "line line-char" : "line line-learner" });
    const say = h("p", { class: "say" });
    say.lang = code;
    const row: Row = { li, say };
    li.append(h("p", { class: "who" }, turn.role === "character" ? name : "You"), say);
    if (turn.role === "character") {
      const report = h("button", { class: "btn btn-plain btn-small", type: "button" }, "Report a mistake");
      report.addEventListener("click", () => {
        cb.onReport(turn.id);
        report.replaceWith(h("span", { class: "reported", role: "status" }, "Reported"));
      });
      row.report = report;
      li.append(report);
    } else {
      row.chips = h("div", { class: "chip-row" });
      li.append(row.chips);
    }
    return row;
  }

  return {
    element,
    sceneRoot,
    confirmSlot,
    micSlot,
    footerSlot,
    applyTurn(turn) {
      empty.hidden = true;
      let row = rows.get(turn.id);
      if (!row) {
        row = makeRow(turn);
        rows.set(turn.id, row);
        transcript.append(row.li);
      }
      row.say.textContent = turn.text;
      if (turn.role === "character" && turn.reported && row.report?.isConnected) {
        row.report.replaceWith(h("span", { class: "reported", role: "status" }, "Reported"));
      }
      scrollToNewest();
    },
    removeTurn(turnId) {
      rows.get(turnId)?.li.remove();
      rows.delete(turnId);
      if (rows.size === 0) empty.hidden = false;
    },
    applyIssues(turnId, issues) {
      const row = rows.get(turnId);
      if (!row?.chips) return;
      const nodes: Node[] = [];
      for (const chip of chipsFor(issues)) {
        chipCounter += 1;
        const noteId = `chip-note-${chipCounter}`;
        const btn = h(
          "button",
          { class: "chip", type: "button", title: chip.reason, "aria-describedby": noteId, "aria-expanded": "false" },
          h("strong", { lang: code }, chip.suggestion),
          h("span", {}, chip.rule),
        );
        const note = h("p", { class: "chip-note", id: noteId }, chip.reason);
        btn.addEventListener("click", () => {
          btn.setAttribute("aria-expanded", btn.getAttribute("aria-expanded") === "true" ? "false" : "true");
        });
        nodes.push(btn, note);
      }
      row.chips.replaceChildren(...nodes);
      scrollToNewest();
    },
    setHint(turnId, text) {
      const row = rows.get(turnId);
      if (!row) return;
      row.li.querySelector(".hint")?.remove();
      row.li.append(h("p", { class: "hint" }, text));
      scrollToNewest();
    },
    setSpeaking(on) {
      speaking.hidden = !on;
    },
    setSteps,
    setNotice(node) {
      noticeSlot.replaceChildren(...(node ? [node] : []));
    },
    setBusy(on) {
      busy = on;
      input.disabled = on;
      refreshSend();
    },
    setEnded(info) {
      inputs.hidden = true;
      endRow.hidden = true;
      speaking.hidden = true;
      endedSlot.replaceChildren(
        h(
          "div",
          { class: "notice", role: "status" },
          icon("info"),
          h("div", {}, h("p", {}, "Conversation ended."), h("p", { class: "muted" }, info.reason)),
        ),
        h(
          "div",
          { class: "actions" },
          h("a", { class: "btn btn-primary", href: info.recapHref }, "Open recap"),
          h("a", { class: "btn btn-plain", href: info.libraryHref }, "Back to library"),
        ),
      );
    },
    get inputsDisabled() {
      return busy;
    },
  };
}
