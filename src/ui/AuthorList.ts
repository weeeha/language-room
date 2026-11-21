// Authoring list (route /author): scenarios made in this browser, duplicate from a bundled one, import.
import { duplicateScenario, importText } from "../author/form";
import { getScenarioStore, type LocalScenario, type ScenarioStore } from "../author/store";
import { h } from "./dom";
import type { Screen } from "./router";
import { paths } from "./routes";
import { bundledScenarios } from "./scenarios";
import { SHIP_TEXT, LOCAL_TEXT } from "./Author";

export const EMPTY_AUTHOR_LIST = "You have not written a scenario in this browser yet.";

function reviewText(s: LocalScenario["scenario"]): string {
  return s.reviewed ? `Reviewed by ${s.reviewed.by} on ${s.reviewed.on}` : "Not reviewed";
}

export function createAuthorList(store: ScenarioStore = getScenarioStore(), navigate: (path: string) => void = defaultNavigate): Screen {
  const listHost = h("div", {});
  const status = h("p", { class: "status", role: "status" });
  const importErrors = h("div", {});
  let gone = false;

  async function reload(): Promise<void> {
    let items: LocalScenario[];
    try {
      items = await store.list();
    } catch {
      if (!gone) listHost.replaceChildren(h("div", { class: "notice notice-error" }, h("p", {}, "This browser would not open its saved scenarios. Reload the page, or check that site data is allowed.")));
      return;
    }
    if (gone) return;
    if (items.length === 0) {
      listHost.replaceChildren(h("p", { class: "muted" }, EMPTY_AUTHOR_LIST));
      return;
    }
    listHost.replaceChildren(h("ul", { class: "plain-list" }, ...items.map((item) => row(item))));
  }

  function row(item: LocalScenario): HTMLElement {
    const s = item.scenario;
    const confirmSlot = h("span", {});
    const del = h("button", { class: "btn btn-small", type: "button", "aria-label": `Delete ${s.title}` }, "Delete");
    del.addEventListener("click", () => {
      const yes = h("button", { class: "btn btn-small", type: "button" }, "Delete permanently");
      const no = h("button", { class: "btn btn-small", type: "button" }, "Keep it");
      yes.addEventListener("click", () => {
        void store.remove(s.id).then(() => {
          status.textContent = `Deleted ${s.title}.`;
          return reload();
        });
      });
      no.addEventListener("click", () => {
        confirmSlot.replaceChildren();
        del.hidden = false;
        del.focus();
      });
      del.hidden = true;
      confirmSlot.replaceChildren(h("span", { class: "confirm-text" }, `Delete ${s.title}? This cannot be undone.`), yes, no);
      yes.focus();
    });
    const title = h("p", { class: "label" }, s.title);
    return h(
      "li",
      { class: "list-row" },
      title,
      h("p", { class: "muted" }, `${s.language.name}, ${s.level}. Version ${s.version}. ${reviewText(s)}.`),
      h("div", { class: "actions" }, h("a", { class: "btn btn-small", href: paths.authorEdit(s.id), "aria-label": `Edit ${s.title}` }, "Edit"), del, confirmSlot),
    );
  }

  async function duplicate(id: string): Promise<void> {
    const source = bundledScenarios().find((e) => e.scenario.id === id)?.scenario;
    if (!source) return;
    const taken = [...bundledScenarios().map((e) => e.scenario.id), ...(await store.list()).map((x) => x.id)];
    const copy = duplicateScenario(source, taken);
    await store.put(copy);
    navigate(paths.authorEdit(copy.id));
  }

  const bundled = bundledScenarios();
  const bundledList = h(
    "ul",
    { class: "plain-list" },
    ...bundled.map((e) => {
      const btn = h("button", { class: "btn btn-small", type: "button", "aria-label": `Duplicate ${e.scenario.title}` }, "Duplicate");
      btn.addEventListener("click", () => void duplicate(e.scenario.id));
      return h("li", { class: "list-row" }, h("p", { class: "label" }, e.scenario.title), h("p", { class: "muted" }, `${e.scenario.language.name}, ${e.scenario.level}.`), btn);
    }),
  );

  const fileInput = h("input", { type: "file", id: "import-file", accept: ".json,application/json" });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    importErrors.replaceChildren();
    status.textContent = "";
    void file
      .text()
      .then(async (text) => {
        const result = importText(text);
        if (!result.ok) {
          importErrors.replaceChildren(
            h("div", { class: "notice notice-error", role: "alert" }, h("div", {}, h("p", { class: "label" }, `${file.name} is not a valid scenario file`), h("ul", {}, ...result.errors.map((e) => h("li", {}, e))))),
          );
          return;
        }
        const s = result.scenario;
        if (bundled.some((e) => e.scenario.id === s.id)) {
          importErrors.replaceChildren(h("div", { class: "notice notice-error", role: "alert" }, h("p", {}, `A bundled scenario already uses the id ${s.id}. Change the id in the file, then import it again.`)));
          return;
        }
        if (await store.get(s.id)) {
          importErrors.replaceChildren(h("div", { class: "notice notice-error", role: "alert" }, h("p", {}, `A scenario with the id ${s.id} is already in this browser. Delete it first, or change the id in the file.`)));
          return;
        }
        await store.put(s);
        navigate(paths.authorEdit(s.id));
      })
      .catch(() => {
        importErrors.replaceChildren(h("div", { class: "notice notice-error", role: "alert" }, h("p", {}, "The file could not be read.")));
      })
      .finally(() => {
        fileInput.value = "";
      });
  });

  void reload();

  const root = h(
    "div",
    { class: "text-col author" },
    h("h1", {}, "Your scenarios"),
    h("p", { class: "muted" }, LOCAL_TEXT),
    h("p", {}, h("a", { class: "btn btn-primary", href: paths.authorNew() }, "New scenario")),
    status,
    listHost,
    h("h2", {}, "Start from a bundled scenario"),
    h("p", { class: "muted" }, "Duplicate makes a copy in this browser that you can edit. The bundled file does not change."),
    bundledList,
    h("h2", {}, "Import a scenario file"),
    h("div", { class: "field" }, h("label", { for: "import-file" }, "Scenario file (.json)"), fileInput),
    importErrors,
    h("p", { class: "muted" }, SHIP_TEXT),
    h("p", {}, h("a", { class: "tap", href: paths.library() }, "Back to library")),
  );
  return {
    title: "Your scenarios",
    element: root,
    dispose() {
      gone = true;
    },
  };
}

function defaultNavigate(path: string): void {
  history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
