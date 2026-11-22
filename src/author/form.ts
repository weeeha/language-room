// Pure logic of the authoring form (docs/spec.md sections 3 and 4.1). No DOM, no storage.
// The form state is turned into the scenario object, and the same validator checks it.
import { loadScenario } from "../scenario/load";
import {
  validateScenario,
  type Hotspot,
  type Level,
  type Scenario,
  type SceneFormat,
  type Signage,
  type Vec3,
} from "../scenario/validate";

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const DEFAULT_LANGUAGE = { code: "pt-PT", name: "European Portuguese" } as const;

/** Ids that the routes use for other screens. A scenario cannot take them. */
export const RESERVED_IDS = ["new", "import"] as const;

export interface StepRow {
  id: string;
  hint: string;
  /** True once the author typed the id, so changing the hint no longer changes it. */
  idEdited: boolean;
}

export interface SceneState {
  file: string;
  format: SceneFormat;
  source?: string;
  tiers?: { low?: string; default?: string };
  spawn: { position: Vec3; lookAt: Vec3 };
}

export interface FormState {
  /** True until the first save. The id can be changed only while the scenario is new. */
  isNew: boolean;
  id: string;
  idEdited: boolean;
  title: string;
  languageCode: string;
  languageName: string;
  level: Level;
  placeName: string;
  /** Stored as place.scene.prompt when a scene is attached, else as place.prompt. */
  placePrompt: string;
  scene: SceneState | null;
  hotspots: Hotspot[];
  signage: Signage[];
  characterName: string;
  role: string;
  persona: string;
  anchor?: Vec3;
  voice?: { tts?: string; rate?: number };
  goalDescription: string;
  completion?: string;
  steps: StepRow[];
  phrases: string[];
  grammar: string[];
  /** Carried over from a loaded scenario. The form has no control that sets it before task 26. */
  reviewed?: { by: string; on: string };
}

export function emptyForm(): FormState {
  return {
    isNew: true,
    id: "",
    idEdited: false,
    title: "",
    languageCode: DEFAULT_LANGUAGE.code,
    languageName: DEFAULT_LANGUAGE.name,
    level: "A1",
    placeName: "",
    placePrompt: "",
    scene: null,
    hotspots: [],
    signage: [],
    characterName: "",
    role: "",
    persona: "",
    goalDescription: "",
    steps: [{ id: "", hint: "", idEdited: false }],
    phrases: [],
    grammar: [],
  };
}

// ---------- ids ----------

/** Lowercase letters, digits and hyphens, with accents removed. */
export function slugify(text: string, maxLength = 48): string {
  const base = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, maxLength).replace(/-+$/g, "");
}

/** The slug, or the slug with -2, -3 and so on when it is already taken. */
export function uniqueSlug(base: string, taken: readonly string[], fallback = "item"): string {
  const root = base || fallback;
  if (!taken.includes(root)) return root;
  let n = 2;
  while (taken.includes(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}

export function deriveScenarioId(title: string): string {
  return slugify(title);
}

/** A step id from the hint: the first words, so it stays short. */
export function deriveStepId(hint: string, others: readonly string[], fallback = "step"): string {
  const words = hint.trim().split(/\s+/).slice(0, 4).join(" ");
  return uniqueSlug(slugify(words, 30), others, fallback);
}

// ---------- state changes (each returns a new state) ----------

/** While a scenario is new, the scene path follows the id: media/<id>/<file>. */
export function retargetScenePath(state: FormState): FormState {
  if (!state.isNew || !state.scene || !ID_PATTERN.test(state.id.trim())) return state;
  const m = /^media\/[^/]+\/([^/]+)$/.exec(state.scene.file);
  if (!m) return state;
  const file = `media/${state.id.trim()}/${m[1]}`;
  return file === state.scene.file ? state : { ...state, scene: { ...state.scene, file } };
}

export function setTitle(state: FormState, title: string): FormState {
  const next = { ...state, title };
  if (state.isNew && !state.idEdited) next.id = deriveScenarioId(title);
  return retargetScenePath(next);
}

export function setId(state: FormState, id: string): FormState {
  return retargetScenePath({ ...state, id, idEdited: true });
}

export function addStep(state: FormState): FormState {
  return { ...state, steps: [...state.steps, { id: "", hint: "", idEdited: false }] };
}

export function removeStep(state: FormState, index: number): FormState {
  return { ...state, steps: state.steps.filter((_, i) => i !== index) };
}

/** Moves a step by one place. A move past either end changes nothing. */
export function moveStep(state: FormState, index: number, direction: -1 | 1): FormState {
  const to = index + direction;
  if (index < 0 || index >= state.steps.length || to < 0 || to >= state.steps.length) return state;
  const steps = [...state.steps];
  const [item] = steps.splice(index, 1);
  steps.splice(to, 0, item as StepRow);
  return { ...state, steps };
}

export function setStepHint(state: FormState, index: number, hint: string): FormState {
  const steps = state.steps.map((s) => ({ ...s }));
  const step = steps[index];
  if (!step) return state;
  step.hint = hint;
  if (!step.idEdited) {
    const others = steps.filter((_, i) => i !== index).map((s) => s.id);
    step.id = hint.trim() ? deriveStepId(hint, others) : "";
  }
  return { ...state, steps };
}

export function setStepId(state: FormState, index: number, id: string): FormState {
  const steps = state.steps.map((s) => ({ ...s }));
  const step = steps[index];
  if (!step) return state;
  step.id = id;
  step.idEdited = true;
  return { ...state, steps };
}

export function addHotspot(state: FormState): FormState {
  return { ...state, hotspots: [...state.hotspots, { id: "", word: "", gloss: "", position: [0, 0, 0] }] };
}

export function removeHotspot(state: FormState, index: number): FormState {
  return { ...state, hotspots: state.hotspots.filter((_, i) => i !== index) };
}

export function setHotspotText(state: FormState, index: number, field: "word" | "gloss", value: string): FormState {
  const hotspots = state.hotspots.map((x) => ({ ...x }));
  const item = hotspots[index];
  if (!item) return state;
  const wasAuto = item.id === "" || item.id === autoId(item.word, hotspots, index, "word");
  item[field] = value;
  if (field === "word" && wasAuto) item.id = value.trim() ? autoId(value, hotspots, index, "word") : "";
  return { ...state, hotspots };
}

export function addSign(state: FormState): FormState {
  return { ...state, signage: [...state.signage, { id: "", anchor: [0, 0, 0], text: "" }] };
}

export function removeSign(state: FormState, index: number): FormState {
  return { ...state, signage: state.signage.filter((_, i) => i !== index) };
}

export function setSignText(state: FormState, index: number, value: string): FormState {
  const signage = state.signage.map((x) => ({ ...x }));
  const item = signage[index];
  if (!item) return state;
  const wasAuto = item.id === "" || item.id === autoId(item.text, signage, index, "sign");
  item.text = value;
  if (wasAuto) item.id = value.trim() ? autoId(value, signage, index, "sign") : "";
  return { ...state, signage };
}

function autoId(text: string, list: readonly { id: string }[], index: number, fallback: string): string {
  const others = list.filter((_, i) => i !== index).map((x) => x.id);
  const words = text.trim().split(/\s+/).slice(0, 4).join(" ");
  return uniqueSlug(slugify(words, 30), others, fallback);
}

/** Lines of a text box into a list: trimmed, empty lines dropped. */
export function linesToList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

// ---------- state to scenario and back ----------

const trim = (s: string): string => s.trim();

/** The scenario object for the current form. It may be invalid: the validator decides. */
export function buildScenario(state: FormState, version: number): Scenario {
  const prompt = trim(state.placePrompt);
  const place: Record<string, unknown> = { name: trim(state.placeName) };
  if (prompt && !state.scene) place.prompt = prompt;
  if (state.scene) {
    const scene: Record<string, unknown> = { file: trim(state.scene.file), format: state.scene.format };
    if (state.scene.source) scene.source = state.scene.source;
    if (prompt) scene.prompt = prompt;
    if (state.scene.tiers) scene.tiers = structuredClone(state.scene.tiers);
    scene.spawn = structuredClone(state.scene.spawn);
    place.scene = scene;
  }
  if (state.hotspots.length > 0) {
    place.hotspots = state.hotspots.map((x) => ({
      id: trim(x.id),
      position: [...x.position] as Vec3,
      word: trim(x.word),
      gloss: trim(x.gloss),
    }));
  }
  if (state.signage.length > 0) {
    place.signage = state.signage.map((x) => ({ id: trim(x.id), anchor: [...x.anchor] as Vec3, text: trim(x.text) }));
  }

  const character: Record<string, unknown> = {
    name: trim(state.characterName),
    role: trim(state.role),
    persona: trim(state.persona),
  };
  if (state.voice) character.voice = structuredClone(state.voice);
  if (state.anchor) character.anchor = [...state.anchor];

  const goal: Record<string, unknown> = {
    description: trim(state.goalDescription),
    steps: state.steps.map((s) => ({ id: trim(s.id), hint: trim(s.hint) })),
  };
  if (state.completion) goal.completion = state.completion;

  const out: Record<string, unknown> = {
    id: trim(state.id),
    version,
    title: trim(state.title),
    language: { code: trim(state.languageCode), name: trim(state.languageName) },
    level: state.level,
    place,
    character,
    goal,
    targets: {
      phrases: state.phrases.map(trim).filter(Boolean),
      grammar: state.grammar.map(trim).filter(Boolean),
    },
  };
  if (state.reviewed) out.reviewed = { ...state.reviewed };
  return out as unknown as Scenario;
}

/** The form state for a scenario. isNew is false: the scenario already has an id to keep. */
export function formFromScenario(s: Scenario): FormState {
  const scene = s.place.scene;
  const state: FormState = {
    isNew: false,
    id: s.id,
    idEdited: true,
    title: s.title,
    languageCode: s.language.code,
    languageName: s.language.name,
    level: s.level,
    placeName: s.place.name,
    placePrompt: scene?.prompt ?? s.place.prompt ?? "",
    scene: scene
      ? {
          file: scene.file,
          format: scene.format,
          ...(scene.source !== undefined ? { source: scene.source } : {}),
          ...(scene.tiers ? { tiers: structuredClone(scene.tiers) } : {}),
          spawn: structuredClone(scene.spawn),
        }
      : null,
    hotspots: structuredClone(s.place.hotspots ?? []),
    signage: structuredClone(s.place.signage ?? []),
    characterName: s.character.name,
    role: s.character.role,
    persona: s.character.persona,
    goalDescription: s.goal.description,
    steps: s.goal.steps.map((x) => ({ id: x.id, hint: x.hint, idEdited: true })),
    phrases: [...s.targets.phrases],
    grammar: [...s.targets.grammar],
  };
  if (s.character.anchor) state.anchor = [...s.character.anchor];
  if (s.character.voice) state.voice = structuredClone(s.character.voice);
  if (s.goal.completion) state.completion = s.goal.completion;
  if (s.reviewed) state.reviewed = { ...s.reviewed };
  return state;
}

// ---------- versions ----------

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** The scenario's content: everything except the version and the review block. */
export function contentKey(s: Scenario): string {
  const { version: _version, reviewed: _reviewed, ...rest } = s;
  void _version;
  void _reviewed;
  return canonical(rest);
}

/** 1 for a new scenario. One more than the saved version when the content changed. Else unchanged. */
export function nextVersion(saved: Scenario | undefined, candidate: Scenario): number {
  if (!saved) return 1;
  return contentKey(saved) === contentKey(candidate) ? saved.version : saved.version + 1;
}

// ---------- validation and field mapping ----------

export interface FormCheck {
  valid: boolean;
  errors: string[];
  scenario: Scenario;
}

export interface CheckOptions {
  /** Ids of bundled scenarios. A new scenario cannot reuse one. */
  bundledIds?: readonly string[];
  /** Ids of other local scenarios. A new scenario cannot reuse one. */
  localIds?: readonly string[];
}

function duplicates(ids: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const id of ids) {
    if (!id) continue;
    if (seen.has(id)) dup.add(id);
    seen.add(id);
  }
  return dup;
}

/** The validator's errors plus the checks that need the whole form: unique ids and reserved ids. */
export function checkForm(state: FormState, version: number, opts: CheckOptions = {}): FormCheck {
  const scenario = buildScenario(state, version);
  const result = validateScenario(scenario);
  const errors = result.valid ? [] : result.errors.map((e) => (e.startsWith("id: must use") && !scenario.id ? "id: required" : e));

  const id = scenario.id;
  if (id && (RESERVED_IDS as readonly string[]).includes(id)) errors.push(`id: "${id}" is reserved, choose another`);
  if (state.isNew && id) {
    if (opts.bundledIds?.includes(id)) errors.push("id: a bundled scenario already uses this id");
    else if (opts.localIds?.includes(id)) errors.push("id: another scenario in this browser already uses this id");
  }
  const stepDup = duplicates(scenario.goal.steps.map((s) => s.id));
  scenario.goal.steps.forEach((s, i) => {
    if (stepDup.has(s.id)) errors.push(`goal.steps[${i}].id: must be different from the other steps`);
  });
  const hotDup = duplicates((scenario.place.hotspots ?? []).map((x) => x.id));
  (scenario.place.hotspots ?? []).forEach((x, i) => {
    if (hotDup.has(x.id)) errors.push(`place.hotspots[${i}].id: must be different from the other words`);
  });
  const signDup = duplicates((scenario.place.signage ?? []).map((x) => x.id));
  (scenario.place.signage ?? []).forEach((x, i) => {
    if (signDup.has(x.id)) errors.push(`place.signage[${i}].id: must be different from the other signs`);
  });
  return { valid: errors.length === 0, errors, scenario };
}

/** The form field a validator path belongs to. Paths with no field of their own keep their text. */
export function fieldKeyForPath(path: string): string {
  const p = path.trim();
  const rules: [RegExp, string][] = [
    [/^place\.hotspots\[(\d+)\]\.(id|word|gloss)$/, "hotspots[$1].$2"],
    [/^place\.hotspots\[(\d+)\]\.position$/, "hotspots[$1].position"],
    [/^place\.signage\[(\d+)\]\.(id|text)$/, "signage[$1].$2"],
    [/^place\.signage\[(\d+)\]\.anchor$/, "signage[$1].position"],
    [/^place\.hotspots(\[\d+\])?$/, "hotspots"],
    [/^place\.signage(\[\d+\])?$/, "signage"],
    [/^place\.scene(\..*)?$/, "scene"],
    [/^character\.voice(\..*)?$/, "character.voice"],
    [/^goal\.steps\[(\d+)\]\.(id|hint)$/, "steps[$1].$2"],
    [/^goal\.steps(\[\d+\])?$/, "steps"],
    [/^targets\.phrases(\[\d+\])?$/, "phrases"],
    [/^targets\.grammar(\[\d+\])?$/, "grammar"],
    [/^place\.name$/, "placeName"],
    [/^place\.prompt$/, "placePrompt"],
    [/^place$/, "placeName"],
    [/^language\.code$/, "languageCode"],
    [/^language\.name$/, "languageName"],
    [/^character\.name$/, "characterName"],
    [/^character\.role$/, "role"],
    [/^character\.persona$/, "persona"],
    [/^character\.anchor$/, "nametag"],
    [/^goal\.description$/, "goalDescription"],
  ];
  for (const [re, key] of rules) if (re.test(p)) return p.replace(re, key);
  return p;
}

export interface SplitError {
  path: string;
  message: string;
}

export function splitError(error: string): SplitError {
  const at = error.indexOf(": ");
  if (at < 0) return { path: "", message: error };
  return { path: error.slice(0, at), message: error.slice(at + 2) };
}

/** Plain wording for the validator's short messages. */
export function friendlyMessage(message: string): string {
  switch (message) {
    case "required":
    case "must be a non-empty string":
      return "Enter a value.";
    case "must have at least one entry":
      return "Add at least one.";
    case "must have at least one step":
      return "Add at least one step.";
    case "must be a BCP 47 tag such as pt-PT":
      return "Use a language tag such as pt-PT.";
    case "must use lowercase letters, digits and hyphens":
      return "Use lowercase letters, digits and hyphens only.";
    case "must be an array of 3 numbers":
      return "Enter three numbers.";
    default:
      return message.charAt(0).toUpperCase() + message.slice(1) + (message.endsWith(".") ? "" : ".");
  }
}

export interface GroupedErrors {
  /** Messages by field key, for fields the form shows. */
  byField: Map<string, string[]>;
  /** Errors with no field on screen. They go in the summary at the top. */
  unmapped: string[];
}

export function groupErrors(errors: readonly string[], known: ReadonlySet<string>): GroupedErrors {
  const byField = new Map<string, string[]>();
  const unmapped: string[] = [];
  for (const e of errors) {
    const { path, message } = splitError(e);
    const key = fieldKeyForPath(path);
    if (path && known.has(key)) {
      const list = byField.get(key) ?? [];
      list.push(friendlyMessage(message));
      byField.set(key, list);
    } else unmapped.push(e);
  }
  return { byField, unmapped };
}

// ---------- export and import ----------

/** The text of the exported file: the scenario object, pretty printed. */
export function exportText(scenario: Scenario): string {
  return `${JSON.stringify(scenario, null, 2)}\n`;
}

export function exportFileName(scenario: Scenario): string {
  return `${scenario.id}.json`;
}

export type ImportResult = { ok: true; scenario: Scenario } | { ok: false; errors: string[] };

/** Reads the text of a file. A failure carries the validator's own errors. */
export function importText(text: string): ImportResult {
  const result = loadScenario(text);
  return result.valid ? { ok: true, scenario: result.scenario } : { ok: false, errors: result.errors };
}

/** A new id based on an existing one, such as lisbon-cafe-pt-copy. */
export function copyId(id: string, taken: readonly string[]): string {
  return uniqueSlug(`${id}-copy`, taken);
}

/** A copy of a scenario for editing: version 1, no review block, a new id. */
export function duplicateScenario(source: Scenario, taken: readonly string[]): Scenario {
  const copy = structuredClone(source);
  copy.id = copyId(source.id, taken);
  copy.version = 1;
  delete copy.reviewed;
  copy.title = `${source.title} (copy)`;
  return copy;
}
