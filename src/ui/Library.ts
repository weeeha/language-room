// Library screen (port of draft/index.html). Lists reviewed scenarios.
import { h } from "./dom";
import { lastFinishedSession } from "./lastRecap";
import { paths } from "./routes";
import { availableEntries, bundledScenarios, type ScenarioEntry } from "./scenarios";
import type { Screen } from "./router";
import { getStore } from "./runtime";

export const EMPTY_LIBRARY = "No scenarios are available yet. Add a reviewed scenario file to the scenarios folder.";

function fact(label: string, value: string, langCode?: string): HTMLDivElement {
  const dd = h("dd", {}, value);
  if (langCode) dd.lang = langCode;
  return h("div", {}, h("dt", {}, label), dd);
}

function card(entry: ScenarioEntry): HTMLElement {
  const s = entry.scenario;
  const titleId = `scn-${s.id}`;
  return h(
    "article",
    { class: "card", "aria-labelledby": titleId },
    h("h2", { id: titleId }, s.title),
    h(
      "dl",
      { class: "facts" },
      fact("Language", s.language.name),
      fact("Level", s.level),
      fact("Place", s.place.name),
      fact("Goal", s.goal.description),
    ),
    h("a", { class: "btn", href: paths.brief(s.id) }, "Open scenario"),
  );
}

export function createLibrary(opts: { dev?: boolean } = {}): Screen {
  const dev = opts.dev ?? import.meta.env.DEV;
  const all = bundledScenarios();
  const listed = all.filter((e) => e.listed);
  const root = h("div", {}, h("h1", {}, "Scenarios"));
  if (listed.length === 0) root.append(h("p", { class: "muted" }, EMPTY_LIBRARY));
  for (const entry of listed) root.append(card(entry));

  const recapSlot = h("div", {});
  root.append(recapSlot);
  root.append(h("p", { class: "last-recap" }, h("a", { class: "tap", href: paths.author() }, "Write or import a scenario")));

  if (dev) {
    const unlisted = availableEntries(all, true).filter((e) => !e.listed);
    if (unlisted.length > 0) {
      root.append(
        h(
          "section",
          { class: "dev-list", "aria-labelledby": "dev-unreviewed" },
          h("p", { class: "label", id: "dev-unreviewed" }, "Development only: unreviewed scenarios"),
          h(
            "ul",
            {},
            ...unlisted.map((e) => h("li", {}, h("a", { class: "tap", href: paths.brief(e.scenario.id) }, e.scenario.title))),
          ),
        ),
      );
    }
  }

  let gone = false;
  void getStore()
    .list()
    .then((sessions) => {
      if (gone) return;
      const last = lastFinishedSession(sessions);
      if (!last) return;
      const entry = all.find((e) => e.scenario.id === last.scenarioId);
      if (!entry) return;
      recapSlot.append(
        h(
          "p",
          { class: "last-recap" },
          `Last recap: ${entry.scenario.title} `,
          h("a", { class: "tap", href: paths.recap(last.scenarioId, last.id) }, "Open last recap"),
        ),
      );
    })
    .catch(() => undefined);

  return {
    title: "Scenarios",
    element: root,
    dispose() {
      gone = true;
    },
  };
}
