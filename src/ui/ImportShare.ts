// Opens a share link (/s/import#payload). The payload is checked with the validator before anything
// is stored. The scenario is added to this browser only when the visitor says so.
import { decodePayload, type DecodeResult } from "../author/share";
import { reviewLine, UNREVIEWED_WARNING } from "../author/review";
import { getScenarioStore, type ScenarioStore } from "../author/store";
import { h } from "./dom";
import { goTo, type Screen } from "./router";
import { paths } from "./routes";
import { findScenario } from "./scenarios";

export async function createImportShare(
  store: ScenarioStore = getScenarioStore(),
  hash: string = location.hash,
  navigate: (path: string) => void = goTo,
): Promise<Screen> {
  const result: DecodeResult = await decodePayload(hash);
  const back = h("p", {}, h("a", { class: "tap", href: paths.library() }, "Back to library"));
  if (!result.ok) {
    return {
      title: "Link did not work",
      element: h(
        "div",
        { class: "text-col" },
        h("h1", {}, "This link did not work"),
        h("div", { class: "notice notice-error", role: "alert" }, h("div", {}, h("p", { class: "label" }, "The scenario in the link is not valid."), h("ul", {}, ...result.errors.map((e) => h("li", {}, e))))),
        h("p", {}, "Nothing was added to this browser. Ask the sender for a new link or for the scenario file."),
        back,
      ),
    };
  }
  const s = result.scenario;
  const bundled = findScenario(s.id);
  let existing: Awaited<ReturnType<ScenarioStore["get"]>>;
  try {
    existing = await store.get(s.id);
  } catch {
    existing = undefined;
  }
  const status = h("p", { class: "status", role: "status" });
  const facts = h(
    "dl",
    { class: "facts" },
    h("div", {}, h("dt", {}, "Title"), h("dd", {}, s.title)),
    h("div", {}, h("dt", {}, "Language"), h("dd", {}, s.language.name)),
    h("div", {}, h("dt", {}, "Level"), h("dd", {}, s.level)),
    h("div", {}, h("dt", {}, "Review"), h("dd", {}, reviewLine(s.reviewed))),
  );
  const col = h("div", { class: "text-col" }, h("h1", {}, "A scenario was shared with you"), facts);
  if (!s.reviewed) col.append(h("div", { class: "notice" }, h("p", {}, UNREVIEWED_WARNING)));
  col.append(h("p", { class: "muted" }, "The link carries the scenario text only. The scene file is not part of it, so the scene shows only if the file is on this computer."));
  if (bundled) {
    col.append(
      h("div", { class: "notice notice-error", role: "alert" }, h("p", {}, "A bundled scenario already uses this id, so this one cannot be added.")),
      h("p", {}, h("a", { class: "btn", href: paths.brief(s.id) }, "Open the bundled scenario")),
    );
  } else {
    if (existing) col.append(h("p", {}, `A scenario with this id is already in this browser (version ${existing.scenario.version}). Adding replaces it.`));
    const add = h("button", { class: "btn btn-primary", type: "button" }, existing ? "Replace it and open" : "Add to this browser");
    add.addEventListener("click", () => {
      add.disabled = true;
      void store
        .put(s)
        .then(() => navigate(paths.brief(s.id)))
        .catch(() => {
          add.disabled = false;
          status.textContent = "The scenario could not be saved in this browser. Check that site data is allowed, then try again.";
        });
    });
    col.append(h("div", { class: "actions" }, add), status);
  }
  col.append(back);
  return { title: "Shared scenario", element: col };
}
