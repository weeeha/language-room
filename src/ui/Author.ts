// Authoring form (route /author/:id, docs/spec.md section 3). Plain form, live validation with
// the same validator the app uses. Scenarios are saved in this browser only.
import {
  addHotspot,
  addSign,
  addStep,
  buildScenario,
  checkForm,
  emptyForm,
  exportFileName,
  exportText,
  formFromScenario,
  groupErrors,
  linesToList,
  moveStep,
  nextVersion,
  removeHotspot,
  removeSign,
  removeStep,
  setHotspotText,
  setId,
  setSignText,
  setStepHint,
  setStepId,
  setTitle,
  splitError,
  contentKey,
  DEFAULT_LANGUAGE,
  type FormState,
} from "../author/form";
import { getScenarioStore, type ScenarioStore } from "../author/store";
import { LEVELS, type Level, type Scenario } from "../scenario/validate";
import { h } from "./dom";
import { ADDRESS_CHANGED, type Screen } from "./router";
import { paths } from "./routes";
import { bundledScenarios, resolveScenario } from "./scenarios";

export const SHIP_TEXT =
  "To ship a scenario with the app, put the exported file in the scenarios folder of the project and run npm run validate:scenarios.";
export const LOCAL_TEXT = "Scenarios you write here are saved in this browser only. Nothing is uploaded.";

/** What the scene and review sections need from the form. */
export interface AuthorCtx {
  getState(): FormState;
  /** The saved scenario, or undefined before the first save. */
  getSaved(): Scenario | undefined;
  setState(fn: (s: FormState) => FormState): void;
  /** Called after every change to the state. */
  onChange(fn: () => void): void;
  /** Adds a labelled control with an error slot. The key ties validator errors to it. */
  field(key: string, label: string, control: HTMLElement, hint?: string): HTMLElement;
  announce(text: string): void;
  /** Saves the form when it is valid. Resolves true when saved. */
  save(): Promise<boolean>;
  /** True when the form passes every check. Shows the errors when it does not. */
  checkAll(): boolean;
}

function ctlId(key: string): string {
  return `f-${key.replace(/[^a-zA-Z0-9]+/g, "-").replace(/-+$/, "")}`;
}

function textScreen(title: string, body: string): Screen {
  return {
    title,
    element: h(
      "div",
      { class: "text-col" },
      h("h1", {}, title),
      h("p", {}, body),
      h("p", {}, h("a", { class: "tap", href: paths.author() }, "Back to your scenarios")),
    ),
  };
}

export async function createAuthor(id: string, store: ScenarioStore = getScenarioStore()): Promise<Screen> {
  const isNew = id === "new";
  const bundledIds = bundledScenarios().map((e) => e.scenario.id);
  let saved: Scenario | undefined;
  let localIds: string[] = [];
  try {
    const all = await store.list();
    localIds = all.map((x) => x.id);
    if (!isNew) saved = all.find((x) => x.id === id)?.scenario;
  } catch {
    return textScreen("Scenarios could not be opened", "This browser would not open its saved scenarios. Reload the page, or check that site data is allowed.");
  }
  if (!isNew && !saved) {
    const bundled = await resolveScenario(id, store);
    if (bundled?.source === "bundled") {
      return textScreen("This scenario is part of the app", "Bundled scenarios are read-only. Go back and use Duplicate to make a copy you can edit.");
    }
    return textScreen("Scenario not found", "There is no scenario with this id in this browser.");
  }

  let state: FormState = saved ? formFromScenario(saved) : emptyForm();
  const shown = new Set<string>();
  let showAll = false;
  let otherLanguage = state.languageCode !== DEFAULT_LANGUAGE.code || state.languageName !== DEFAULT_LANGUAGE.name;
  const listeners: (() => void)[] = [];
  const fields = new Map<string, { label: string; control: HTMLElement; error: HTMLElement }>();

  const status = h("p", { class: "sr-only", role: "status", "aria-live": "polite" });
  function announce(text: string): void {
    status.textContent = "";
    // A short pause lets a screen reader notice the same text twice.
    setTimeout(() => {
      status.textContent = text;
    }, 30);
  }

  const summary = h("div", { class: "notice notice-error", id: "error-summary", tabindex: "-1" });
  summary.hidden = true;
  const savedLine = h("p", { class: "muted", id: "saved-line" });

  // ----- checks -----

  function version(): number {
    return nextVersion(saved, buildScenario(state, saved?.version ?? 1));
  }
  function check() {
    return checkForm(state, version(), {
      bundledIds,
      localIds: localIds.filter((x) => x !== saved?.id),
    });
  }

  function refreshErrors(): void {
    const result = check();
    const grouped = groupErrors(result.errors, new Set(fields.keys()));
    for (const [key, f] of fields) {
      const messages = showAll || shown.has(key) ? (grouped.byField.get(key) ?? []) : [];
      f.error.textContent = messages.join(" ");
      f.error.hidden = messages.length === 0;
      if (messages.length > 0) {
        f.control.setAttribute("aria-invalid", "true");
        f.control.setAttribute("aria-describedby", f.error.id);
      } else {
        f.control.removeAttribute("aria-invalid");
        f.control.removeAttribute("aria-describedby");
      }
    }
    if (showAll && !result.valid) {
      const items: HTMLElement[] = [];
      for (const e of result.errors) {
        const { path, message } = splitError(e);
        const g = groupErrors([e], new Set(fields.keys()));
        const key = [...g.byField.keys()][0];
        const f = key ? fields.get(key) : undefined;
        if (key && f) {
          const link = h("a", { href: `#${f.control.id}` }, `${f.label}: ${g.byField.get(key)?.join(" ") ?? ""}`);
          link.addEventListener("click", (ev) => {
            ev.preventDefault();
            f.control.focus();
          });
          items.push(h("li", {}, link));
        } else items.push(h("li", {}, path ? `${path}: ${message}` : message));
      }
      summary.replaceChildren(
        h("div", {}, h("p", { class: "label" }, `${result.errors.length} ${result.errors.length === 1 ? "problem" : "problems"} to fix before saving`), h("ul", {}, ...items)),
      );
      summary.hidden = false;
    } else {
      summary.hidden = true;
    }
    refreshSaved();
  }

  function isDirty(): boolean {
    const now = buildScenario(state, saved?.version ?? 1);
    if (saved) {
      return contentKey(now) !== contentKey(saved) || JSON.stringify(now.reviewed ?? null) !== JSON.stringify(saved.reviewed ?? null);
    }
    return contentKey(now) !== contentKey(buildScenario(emptyForm(), 1));
  }
  function refreshSaved(): void {
    if (isDirty()) savedLine.textContent = saved ? `Unsaved changes. Saved version is ${saved.version}.` : "Not saved yet.";
    else savedLine.textContent = saved ? `Saved. Version ${saved.version}.` : "Nothing to save yet.";
  }

  function changed(): void {
    refreshErrors();
    for (const fn of listeners) fn();
  }
  function setState(fn: (s: FormState) => FormState): void {
    state = fn(state);
    changed();
  }

  // ----- field helper -----

  function field(key: string, label: string, control: HTMLElement, hint?: string): HTMLElement {
    control.id = ctlId(key);
    const error = h("p", { class: "field-error", id: `${ctlId(key)}-error` });
    error.hidden = true;
    fields.set(key, { label, control, error });
    const parts: (Node | null)[] = [h("label", { for: control.id }, label)];
    if (hint) parts.push(h("p", { class: "muted field-hint" }, hint));
    parts.push(control, error);
    return h("div", { class: "field", "data-field": key }, ...parts);
  }

  function textInput(value: string, on: (v: string) => void, opts: { lang?: boolean; type?: string } = {}): HTMLInputElement {
    const el = h("input", { type: opts.type ?? "text", autocomplete: "off" });
    el.value = value;
    if (opts.lang) {
      el.lang = state.languageCode;
      el.setAttribute("data-target-lang", "");
    }
    el.addEventListener("input", () => on(el.value));
    return el;
  }
  function textArea(value: string, rows: number, on: (v: string) => void, opts: { lang?: boolean } = {}): HTMLTextAreaElement {
    const el = h("textarea", { rows: String(rows) });
    el.value = value;
    if (opts.lang) {
      el.lang = state.languageCode;
      el.setAttribute("data-target-lang", "");
    }
    el.addEventListener("input", () => on(el.value));
    return el;
  }

  // ----- basics -----

  const titleInput = textInput(state.title, (v) => {
    setState((s) => setTitle(s, v));
    if (state.isNew && !state.idEdited) idInput.value = state.id;
  });
  const idInput = textInput(state.id, (v) => setState((s) => setId(s, v)));
  idInput.readOnly = !state.isNew;
  const idHint = state.isNew
    ? "Used in the address of the scenario. It follows the title until you change it, and it is fixed after the first save."
    : "Fixed after the first save, so links to the scenario keep working.";

  const langSelect = h("select", {});
  langSelect.append(
    h("option", { value: "default" }, `${DEFAULT_LANGUAGE.name} (${DEFAULT_LANGUAGE.code})`),
    h("option", { value: "other" }, "Another language"),
  );
  langSelect.value = otherLanguage ? "other" : "default";
  const codeInput = textInput(state.languageCode, (v) => {
    setState((s) => ({ ...s, languageCode: v }));
    syncLang();
  });
  const nameInput = textInput(state.languageName, (v) => setState((s) => ({ ...s, languageName: v })));
  const otherRow = h(
    "div",
    { class: "sublist" },
    field("languageCode", "Language tag", codeInput, "A BCP 47 tag, for example fr-FR."),
    field("languageName", "Language name", nameInput),
  );
  otherRow.hidden = !otherLanguage;
  langSelect.addEventListener("change", () => {
    otherLanguage = langSelect.value === "other";
    otherRow.hidden = !otherLanguage;
    if (!otherLanguage) {
      codeInput.value = DEFAULT_LANGUAGE.code;
      nameInput.value = DEFAULT_LANGUAGE.name;
      setState((s) => ({ ...s, languageCode: DEFAULT_LANGUAGE.code, languageName: DEFAULT_LANGUAGE.name }));
      syncLang();
    }
  });
  function syncLang(): void {
    for (const el of form.querySelectorAll<HTMLElement>("[data-target-lang]")) el.lang = state.languageCode;
  }
  // The language controls are registered only when shown, so the select has no error slot of its own.
  const langField = h("div", { class: "field" }, h("label", { for: "f-language" }, "Language"), langSelect);
  langSelect.id = "f-language";

  const levelSelect = h("select", {});
  for (const l of LEVELS) levelSelect.append(h("option", { value: l }, l));
  levelSelect.value = state.level;
  levelSelect.addEventListener("change", () => setState((s) => ({ ...s, level: levelSelect.value as Level })));

  const basics = h(
    "section",
    { "aria-labelledby": "h-basics" },
    h("h2", { id: "h-basics" }, "Basics"),
    field("title", "Title", titleInput, "What the learner sees in the library."),
    field("id", "Id", idInput, idHint),
    langField,
    otherRow,
    field("level", "Level", levelSelect),
  );

  // ----- place and character -----

  const placeSection = h(
    "section",
    { "aria-labelledby": "h-place" },
    h("h2", { id: "h-place" }, "Place"),
    field("placeName", "Place name", textInput(state.placeName, (v) => setState((s) => ({ ...s, placeName: v })))),
    field(
      "placePrompt",
      "Place prompt (optional)",
      textArea(state.placePrompt, 3, (v) => setState((s) => ({ ...s, placePrompt: v }))),
      "Describe what the place looks like. It is shown to the learner and can be used to generate a scene later.",
    ),
  );

  const characterSection = h(
    "section",
    { "aria-labelledby": "h-character" },
    h("h2", { id: "h-character" }, "Character"),
    field("characterName", "Character name", textInput(state.characterName, (v) => setState((s) => ({ ...s, characterName: v })), { lang: true })),
    field("role", "Role", textInput(state.role, (v) => setState((s) => ({ ...s, role: v }))), "For example: café owner behind the counter."),
    field(
      "persona",
      "Persona",
      textArea(state.persona, 4, (v) => setState((s) => ({ ...s, persona: v }))),
      "How the character behaves and speaks. This guides the conversation.",
    ),
  );

  // ----- goal and steps -----

  const stepsHost = h("ol", { class: "rows" });
  function renderSteps(focusKey?: string): void {
    for (const key of [...fields.keys()]) if (key.startsWith("steps[")) fields.delete(key);
    for (const key of [...shown]) if (key.startsWith("steps[")) shown.delete(key);
    stepsHost.replaceChildren(
      ...state.steps.map((step, i) => {
        const hint = textInput(step.hint, (v) => {
          setState((s) => setStepHint(s, i, v));
          const idEl = document.getElementById(ctlId(`steps[${i}].id`)) as HTMLInputElement | null;
          if (idEl) idEl.value = state.steps[i]?.id ?? "";
        });
        const idEl = textInput(step.id, (v) => setState((s) => setStepId(s, i, v)));
        const up = h("button", { class: "btn btn-small", type: "button", "aria-label": `Move step ${i + 1} up` }, "Up");
        const down = h("button", { class: "btn btn-small", type: "button", "aria-label": `Move step ${i + 1} down` }, "Down");
        const del = h("button", { class: "btn btn-small", type: "button", "aria-label": `Remove step ${i + 1}` }, "Remove");
        up.disabled = i === 0;
        down.disabled = i === state.steps.length - 1;
        up.addEventListener("click", () => {
          setState((s) => moveStep(s, i, -1));
          renderSteps(`steps[${i - 1}].hint`);
        });
        down.addEventListener("click", () => {
          setState((s) => moveStep(s, i, 1));
          renderSteps(`steps[${i + 1}].hint`);
        });
        del.addEventListener("click", () => {
          setState((s) => removeStep(s, i));
          renderSteps(state.steps.length > 0 ? `steps[${Math.max(0, i - 1)}].hint` : "steps-add");
        });
        return h(
          "li",
          { class: "row" },
          field(`steps[${i}].hint`, `Step ${i + 1}`, hint, i === 0 ? "What the learner should do, in English." : undefined),
          field(`steps[${i}].id`, `Step ${i + 1} id`, idEl),
          h("div", { class: "row-actions" }, up, down, del),
        );
      }),
    );
    refreshErrors();
    if (focusKey) (document.getElementById(ctlId(focusKey)) as HTMLElement | null)?.focus();
  }
  const addStepBtn = h("button", { class: "btn", type: "button", id: ctlId("steps-add") }, "Add step");
  addStepBtn.addEventListener("click", () => {
    setState(addStep);
    renderSteps(`steps[${state.steps.length - 1}].hint`);
  });
  const stepsError = h("p", { class: "field-error", id: "f-steps-error" });
  stepsError.hidden = true;
  const stepsGroup = h("div", { class: "field", "data-field": "steps" }, h("p", { class: "label", id: "steps-label" }, "Goal steps"), stepsHost, stepsError, addStepBtn);
  fields.set("steps", { label: "Goal steps", control: stepsHost, error: stepsError });
  stepsHost.id = "f-steps";
  stepsHost.tabIndex = -1;

  const goalSection = h(
    "section",
    { "aria-labelledby": "h-goal" },
    h("h2", { id: "h-goal" }, "Goal"),
    field("goalDescription", "Goal", textInput(state.goalDescription, (v) => setState((s) => ({ ...s, goalDescription: v }))), "One sentence, for example: Order a coffee and ask for the bill."),
    stepsGroup,
  );

  // ----- words -----

  const phrases = textArea(state.phrases.join("\n"), 5, (v) => setState((s) => ({ ...s, phrases: linesToList(v) })), { lang: true });
  const grammar = textArea(state.grammar.join("\n"), 3, (v) => setState((s) => ({ ...s, grammar: linesToList(v) })));

  const hotspotHost = h("ol", { class: "rows" });
  function renderHotspots(focusKey?: string): void {
    for (const key of [...fields.keys()]) if (key.startsWith("hotspots[")) fields.delete(key);
    for (const key of [...shown]) if (key.startsWith("hotspots[")) shown.delete(key);
    hotspotHost.replaceChildren(
      ...state.hotspots.map((item, i) => {
        const word = textInput(item.word, (v) => setState((s) => setHotspotText(s, i, "word", v)), { lang: true });
        const gloss = textInput(item.gloss, (v) => setState((s) => setHotspotText(s, i, "gloss", v)));
        const del = h("button", { class: "btn btn-small", type: "button", "aria-label": `Remove word ${i + 1}` }, "Remove");
        del.addEventListener("click", () => {
          setState((s) => removeHotspot(s, i));
          renderHotspots(state.hotspots.length > 0 ? `hotspots[${Math.max(0, i - 1)}].word` : "hotspots-add");
        });
        return h(
          "li",
          { class: "row" },
          field(`hotspots[${i}].word`, `Word ${i + 1}`, word),
          field(`hotspots[${i}].gloss`, `Word ${i + 1} meaning in English`, gloss),
          h("div", { class: "row-actions" }, del),
        );
      }),
    );
    refreshErrors();
    if (focusKey) (document.getElementById(ctlId(focusKey)) as HTMLElement | null)?.focus();
  }
  const addHotspotBtn = h("button", { class: "btn", type: "button", id: ctlId("hotspots-add") }, "Add word");
  addHotspotBtn.addEventListener("click", () => {
    setState(addHotspot);
    renderHotspots(`hotspots[${state.hotspots.length - 1}].word`);
  });

  const signHost = h("ol", { class: "rows" });
  function renderSigns(focusKey?: string): void {
    for (const key of [...fields.keys()]) if (key.startsWith("signage[")) fields.delete(key);
    for (const key of [...shown]) if (key.startsWith("signage[")) shown.delete(key);
    signHost.replaceChildren(
      ...state.signage.map((item, i) => {
        const text = textInput(item.text, (v) => setState((s) => setSignText(s, i, v)), { lang: true });
        const del = h("button", { class: "btn btn-small", type: "button", "aria-label": `Remove sign ${i + 1}` }, "Remove");
        del.addEventListener("click", () => {
          setState((s) => removeSign(s, i));
          renderSigns(state.signage.length > 0 ? `signage[${Math.max(0, i - 1)}].text` : "signage-add");
        });
        return h("li", { class: "row" }, field(`signage[${i}].text`, `Sign ${i + 1} text`, text), h("div", { class: "row-actions" }, del));
      }),
    );
    refreshErrors();
    if (focusKey) (document.getElementById(ctlId(focusKey)) as HTMLElement | null)?.focus();
  }
  const addSignBtn = h("button", { class: "btn", type: "button", id: ctlId("signage-add") }, "Add sign");
  addSignBtn.addEventListener("click", () => {
    setState(addSign);
    renderSigns(`signage[${state.signage.length - 1}].text`);
  });

  const wordsSection = h(
    "section",
    { "aria-labelledby": "h-words" },
    h("h2", { id: "h-words" }, "Phrases and words"),
    field("phrases", "Target phrases", phrases, "One phrase per line, in the language being taught. Add at least one."),
    field("grammar", "Grammar targets (optional)", grammar, "One per line, for example: polite request with queria."),
    h("h3", {}, "Words in the scene (optional)"),
    h("p", { class: "muted" }, "Each word becomes a small marker in the scene. You place it in the scene later."),
    hotspotHost,
    addHotspotBtn,
    h("h3", {}, "Signs in the scene (optional)"),
    h("p", { class: "muted" }, "Text the learner should read. Write it here, because text inside a generated scene is often wrong."),
    signHost,
    addSignBtn,
  );

  // ----- actions -----

  const saveBtn = h("button", { class: "btn btn-primary", type: "submit" }, "Save");
  const exportBtn = h("button", { class: "btn", type: "button" }, "Export file");
  const actions = h("div", { class: "actions" }, saveBtn, exportBtn, h("a", { class: "btn btn-plain", href: paths.author() }, "Back to your scenarios"));

  function checkAll(): boolean {
    showAll = true;
    refreshErrors();
    const result = check();
    if (!result.valid) {
      summary.focus();
      announce(`${result.errors.length} ${result.errors.length === 1 ? "problem" : "problems"} to fix before saving.`);
    }
    return result.valid;
  }

  async function save(): Promise<boolean> {
    if (!checkAll()) return false;
    const result = check();
    try {
      await store.put(result.scenario);
    } catch {
      announce("The scenario could not be saved in this browser.");
      savedLine.textContent = "The scenario could not be saved in this browser. Check that site data is allowed, then try again.";
      return false;
    }
    saved = result.scenario;
    const wasNew = state.isNew;
    state = { ...state, isNew: false };
    idInput.readOnly = true;
    if (wasNew) {
      history.replaceState({}, "", paths.authorEdit(saved.id));
      window.dispatchEvent(new Event(ADDRESS_CHANGED));
    }
    showAll = false;
    changed();
    announce(`Saved. Version ${saved.version}.`);
    return true;
  }

  function download(scenario: Scenario): void {
    const blob = new Blob([exportText(scenario)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = h("a", { href: url, download: exportFileName(scenario) });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  exportBtn.addEventListener("click", () => {
    if (!checkAll()) return;
    download(check().scenario);
    announce(`Downloaded ${exportFileName(check().scenario)}.`);
  });

  const form = h(
    "form",
    { class: "author-form", novalidate: true },
    basics,
    placeSection,
    characterSection,
    goalSection,
    wordsSection,
  );
  const ctx: AuthorCtx = {
    getState: () => state,
    getSaved: () => saved,
    setState,
    onChange: (fn) => void listeners.push(fn),
    field,
    announce,
    save,
    checkAll,
  };
  void ctx;

  form.append(h("h2", {}, "Save and export"), savedLine, h("p", { class: "muted" }, SHIP_TEXT), actions);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    void save();
  });
  form.addEventListener("focusout", (e) => {
    const wrap = (e.target as Element | null)?.closest<HTMLElement>("[data-field]");
    const key = wrap?.dataset.field;
    if (!key || !fields.has(key)) return;
    shown.add(key);
    refreshErrors();
    const f = fields.get(key);
    if (f && !f.error.hidden) announce(`${f.label}: ${f.error.textContent ?? ""}`);
  });

  renderSteps();
  renderHotspots();
  renderSigns();
  refreshErrors();

  const onBeforeUnload = (e: BeforeUnloadEvent): void => {
    if (!isDirty()) return;
    e.preventDefault();
    e.returnValue = "";
  };
  window.addEventListener("beforeunload", onBeforeUnload);

  const root = h(
    "div",
    { class: "text-col author" },
    h("h1", {}, state.isNew ? "New scenario" : "Edit scenario"),
    h("p", { class: "muted" }, LOCAL_TEXT),
    summary,
    status,
    form,
  );

  return {
    title: state.isNew ? "New scenario" : "Edit scenario",
    element: root,
    leaveWarning: () => (isDirty() ? "You have unsaved changes. Leave without saving?" : null),
    dispose() {
      window.removeEventListener("beforeunload", onBeforeUnload);
    },
  };
}
