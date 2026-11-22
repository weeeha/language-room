// Library screen (port of draft/index.html). Lists reviewed scenarios.
import { reviewLine } from "../author/review";
import { h } from "./dom";
import { lastFinishedSession } from "./lastRecap";
import { paths } from "./routes";
import { availableEntries, bundledScenarios, libraryEntries, localEntries, type ScenarioEntry } from "./scenarios";
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
    h("p", { class: "muted" }, `${reviewLine(s.reviewed)}.`),
    h("a", { class: "btn", href: paths.brief(s.id) }, "Open scenario"),
  );
}

export function createLibrary(opts: { dev?: boolean } = {}): Screen {
  const dev = opts.dev ?? import.meta.env.DEV;
  const all = bundledScenarios();
  const root = h("div", {}, h("h1", {}, "Scenarios"));
  // Reviewed scenarios only: the bundled ones now, and the ones saved in this browser once they load.
  const listHost = h("div", {});
  function renderList(local: ScenarioEntry[]): void {
    const listed = libraryEntries(all, local);
    listHost.replaceChildren(...(listed.length === 0 ? [h("p", { class: "muted" }, EMPTY_LIBRARY)] : listed.map((e) => card(e))));
  }
  renderList([]);
  root.append(listHost);

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
  const localLoaded = localEntries().then((local) => {
    if (!gone && local.length > 0) renderList(local);
    return local;
  });
  void Promise.all([getStore().list(), localLoaded])
    .then(([sessions, local]) => {
      if (gone) return;
      const last = lastFinishedSession(sessions);
      if (!last) return;
      const entry = [...all, ...local].find((e) => e.scenario.id === last.scenarioId);
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
