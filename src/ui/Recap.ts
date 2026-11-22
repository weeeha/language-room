// Recap screen (port of draft/recap.html). Loads the session, builds the recap once, then draws it.
import type { LlmProvider } from "../providers/llm";
import type { Scenario } from "../scenario/validate";
import { loadRecap } from "../recap/load";
import { COPY, recapViewModel, type RecapViewModel } from "../recap/view";
import type { RecapMistake } from "../recap/build";
import { h, lang, notice } from "./dom";
import { paths } from "./routes";
import type { Screen } from "./router";
import { getStore, loadRuntime } from "./runtime";

export function notFoundBody(): HTMLElement {
  return h(
    "div",
    { class: "text-col" },
    h("h1", {}, COPY.notFoundTitle),
    h("p", {}, COPY.notFoundBody),
    h("p", {}, h("a", { class: "tap", href: paths.library() }, "Back to library")),
  );
}

function mistakeBlock(m: RecapMistake, code: string): HTMLDListElement {
  const dd = (text: string, inLang: boolean): HTMLElement => {
    const el = h("dd", {}, text);
    if (inLang) el.lang = code;
    return el;
  };
  return h(
    "dl",
    { class: "facts mistake" },
    h("div", {}, h("dt", {}, "You said"), dd(m.learnerText, true)),
    h("div", {}, h("dt", {}, "Corrected form"), dd(m.corrected, true)),
    h("div", {}, h("dt", {}, "Reason"), dd(m.reason, false)),
  );
}

function drawRecap(vm: RecapViewModel, scenario: Scenario): HTMLElement {
  const code = scenario.language.code;
  const root = h("div", { class: "text-col" });
  const transcriptHeading = h("h2", { id: "transcript", tabindex: "-1" }, "Transcript");

  const replay = h("button", { class: "btn", type: "button" }, "Replay transcript");
  replay.addEventListener("click", () => {
    transcriptHeading.scrollIntoView({ block: "start" });
    transcriptHeading.focus();
  });

  root.append(
    h("h1", {}, vm.heading),
    h("p", {}, vm.intro),
    h(
      "div",
      { class: "actions" },
      h("a", { class: "btn btn-primary", href: paths.play(scenario.id) }, "Start again"),
      replay,
      h("a", { class: "btn btn-plain", href: paths.library() }, "Back to library"),
    ),
  );

  root.append(h("h2", {}, "Phrases used"));
  if (vm.phrasesUsed.length === 0) root.append(h("p", {}, vm.phrasesEmpty));
  else {
    root.append(
      h(
        "ul",
        {},
        ...vm.phrasesUsed.map((p) => {
          const li = h("li", {}, p);
          li.lang = code;
          return li;
        }),
      ),
    );
  }

  root.append(h("h2", {}, "Mistakes"));
  if (vm.mistakes.empty) root.append(h("p", {}, vm.mistakes.empty));
  for (const m of vm.mistakes.first) root.append(mistakeBlock(m, code));
  if (vm.mistakes.rest.length > 0) {
    root.append(
      h("p", {}, vm.mistakes.note ?? ""),
      h(
        "ol",
        { class: "scroll-box", tabindex: "0", "aria-label": "More mistakes, scrolling list" },
        ...vm.mistakes.rest.map((m) => h("li", {}, mistakeBlock(m, code))),
      ),
    );
  }

  root.append(
    h("h2", {}, "Phrases to practise"),
    h(
      "ol",
      { class: "practise" },
      ...vm.practise.map((p) => {
        const say = h("p", { class: "say" }, h("strong", {}, p.phrase));
        say.lang = code;
        return h(
          "li",
          {},
          say,
          h("p", {}, `Why: ${p.why}`),
          h("p", {}, 'Example: "', lang(code, p.example), '"'),
        );
      }),
    ),
  );

  root.append(transcriptHeading);
  let chipCounter = 0;
  root.append(
    h(
      "ol",
      { class: "transcript", "aria-label": "Transcript" },
      ...vm.transcript.map((line) => {
        const say = h("p", { class: "say" }, line.text);
        say.lang = code;
        const li = h("li", { class: line.role === "character" ? "line line-char" : "line line-learner" }, h("p", { class: "who" }, line.who), say);
        if (line.role === "learner") {
          const row = h("div", { class: "chip-row" });
          for (const chip of line.chips) {
            chipCounter += 1;
            const noteId = `recap-chip-note-${chipCounter}`;
            const strong = h("strong", {}, chip.suggestion);
            strong.lang = code;
            const btn = h(
              "button",
              { class: "chip", type: "button", title: chip.reason, "aria-describedby": noteId, "aria-expanded": "false" },
              strong,
              h("span", {}, chip.rule),
            );
            btn.addEventListener("click", () => {
              btn.setAttribute("aria-expanded", btn.getAttribute("aria-expanded") === "true" ? "false" : "true");
            });
            row.append(btn, h("p", { class: "chip-note", id: noteId }, chip.reason));
          }
          li.append(row);
        }
        return li;
      }),
    ),
  );
  return root;
}

export interface RecapDeps {
  llm?: LlmProvider;
  reviewer?: LlmProvider;
}

export function createRecap(scenario: Scenario, sessionId: string, deps: RecapDeps = {}): Screen {
  const holder = h("div", {});
  let gone = false;
  let ctl: AbortController | undefined;

  function showLoading(): void {
    holder.replaceChildren(
      h("div", { class: "text-col" }, h("h1", {}, `Recap, ${scenario.title}`), h("p", { class: "status", role: "status" }, COPY.preparing)),
    );
  }

  function showError(): void {
    const box = notice(COPY.error, { error: true, action: { label: "Try again", onClick: () => void run() } });
    holder.replaceChildren(
      h(
        "div",
        { class: "text-col" },
        h("h1", {}, `Recap, ${scenario.title}`),
        box,
        h("p", {}, h("a", { class: "tap", href: paths.library() }, "Back to library")),
      ),
    );
  }

  async function run(): Promise<void> {
    ctl?.abort();
    ctl = new AbortController();
    const mine = ctl;
    showLoading();
    try {
      const llm = deps.llm ?? (await loadRuntime()).providers.llm[0];
      if (!llm) throw new Error("No language model is configured");
      const out = await loadRecap(
        { store: getStore(), llm, reviewer: deps.reviewer ?? llm },
        scenario,
        sessionId,
        { signal: mine.signal },
      );
      if (gone || mine.signal.aborted) return;
      if (out.state === "not-found") {
        holder.replaceChildren(notFoundBody());
        return;
      }
      holder.replaceChildren(drawRecap(recapViewModel(out.recap, out.session, scenario), scenario));
    } catch (e) {
      if (gone || mine.signal.aborted) return;
      console.warn("recap failed", e instanceof Error ? e.message : String(e));
      showError();
    }
  }

  void run();

  return {
    title: "Recap",
    element: holder,
    dispose() {
      gone = true;
      ctl?.abort();
    },
  };
}
