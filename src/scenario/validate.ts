// Hand-written validator for scenario files (docs/spec.md section 4.1).
// It enforces the same rules as scenarios/schema/scenario.schema.json.
// Pure code: no file or network access, so it runs in the browser and in Node.

export const LEVELS = ["A1", "A2", "B1", "B2"] as const;
export type Level = (typeof LEVELS)[number];

export const SCENE_FORMATS = ["spz", "ply"] as const;
export type SceneFormat = (typeof SCENE_FORMATS)[number];

export const REQUIRED_FIELDS = [
  "id",
  "version",
  "title",
  "language",
  "level",
  "place",
  "character",
  "goal",
  "targets",
] as const;

export type Vec3 = [number, number, number];

export interface Scene {
  file: string;
  format: SceneFormat;
  source?: string;
  prompt?: string;
  spawn: { position: Vec3; lookAt: Vec3 };
}

export interface Hotspot {
  id: string;
  position: Vec3;
  word: string;
  gloss: string;
}

export interface Signage {
  id: string;
  anchor: Vec3;
  text: string;
}

export interface Scenario {
  id: string;
  version: number;
  title: string;
  language: { code: string; name: string };
  level: Level;
  place: {
    name: string;
    scene?: Scene;
    hotspots?: Hotspot[];
    signage?: Signage[];
  };
  character: {
    name: string;
    role: string;
    persona: string;
    voice?: { tts?: string; rate?: number };
  };
  goal: {
    description: string;
    steps: { id: string; hint: string }[];
    completion?: string;
  };
  targets: { phrases: string[]; grammar: string[] };
  reviewed?: { by: string; on: string };
}

export type ValidationResult =
  | { valid: true; scenario: Scenario; listed: boolean; warnings: string[] }
  | { valid: false; errors: string[] };

type Obj = Record<string, unknown>;

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const BCP47_PATTERN = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isText(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isRealDate(s: string): boolean {
  if (!DATE_PATTERN.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

class Checker {
  readonly errors: string[] = [];

  fail(path: string, message: string): void {
    this.errors.push(`${path}: ${message}`);
  }

  object(parent: Obj, key: string, path: string): Obj | undefined {
    const v = parent[key];
    if (v === undefined) {
      this.fail(path, "required");
      return undefined;
    }
    if (!isObj(v)) {
      this.fail(path, "must be an object");
      return undefined;
    }
    return v;
  }

  text(parent: Obj, key: string, path: string): void {
    const v = parent[key];
    if (v === undefined) this.fail(path, "required");
    else if (!isText(v)) this.fail(path, "must be a non-empty string");
  }

  optionalText(parent: Obj, key: string, path: string): void {
    if (parent[key] !== undefined && !isText(parent[key])) {
      this.fail(path, "must be a non-empty string");
    }
  }

  vec3(parent: Obj, key: string, path: string): void {
    const v = parent[key];
    if (v === undefined) {
      this.fail(path, "required");
      return;
    }
    const ok =
      Array.isArray(v) &&
      v.length === 3 &&
      v.every((n) => typeof n === "number" && Number.isFinite(n));
    if (!ok) this.fail(path, "must be an array of 3 numbers");
  }

  array(parent: Obj, key: string, path: string): unknown[] | undefined {
    const v = parent[key];
    if (v === undefined) {
      this.fail(path, "required");
      return undefined;
    }
    if (!Array.isArray(v)) {
      this.fail(path, "must be an array");
      return undefined;
    }
    return v;
  }

  stringArray(parent: Obj, key: string, path: string, nonEmpty: boolean): void {
    const v = this.array(parent, key, path);
    if (!v) return;
    if (nonEmpty && v.length === 0) this.fail(path, "must have at least one entry");
    v.forEach((item, i) => {
      if (!isText(item)) this.fail(`${path}[${i}]`, "must be a non-empty string");
    });
  }
}

function checkScene(c: Checker, scene: Obj, path: string): void {
  c.text(scene, "file", `${path}.file`);
  const fmt = scene.format;
  if (fmt === undefined) c.fail(`${path}.format`, "required");
  else if (!SCENE_FORMATS.includes(fmt as SceneFormat)) {
    c.fail(`${path}.format`, `must be one of ${SCENE_FORMATS.join(", ")}`);
  }
  c.optionalText(scene, "source", `${path}.source`);
  c.optionalText(scene, "prompt", `${path}.prompt`);
  const spawn = c.object(scene, "spawn", `${path}.spawn`);
  if (spawn) {
    c.vec3(spawn, "position", `${path}.spawn.position`);
    c.vec3(spawn, "lookAt", `${path}.spawn.lookAt`);
  }
}

function checkList(
  c: Checker,
  place: Obj,
  key: "hotspots" | "signage",
  path: string,
  check: (item: Obj, itemPath: string) => void,
): void {
  if (place[key] === undefined) return;
  const list = c.array(place, key, path);
  list?.forEach((item, i) => {
    const itemPath = `${path}[${i}]`;
    if (!isObj(item)) c.fail(itemPath, "must be an object");
    else check(item, itemPath);
  });
}

export function validateScenario(input: unknown): ValidationResult {
  const c = new Checker();
  if (!isObj(input)) {
    return { valid: false, errors: ["scenario: must be an object"] };
  }

  const id = input.id;
  if (id === undefined) c.fail("id", "required");
  else if (typeof id !== "string" || !ID_PATTERN.test(id)) {
    c.fail("id", "must use lowercase letters, digits and hyphens");
  }

  const version = input.version;
  if (version === undefined) c.fail("version", "required");
  else if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    c.fail("version", "must be a positive integer");
  }

  c.text(input, "title", "title");

  const language = c.object(input, "language", "language");
  if (language) {
    const code = language.code;
    if (code === undefined) c.fail("language.code", "required");
    else if (typeof code !== "string" || !BCP47_PATTERN.test(code)) {
      c.fail("language.code", "must be a BCP 47 tag such as pt-PT");
    }
    c.text(language, "name", "language.name");
  }

  const level = input.level;
  if (level === undefined) c.fail("level", "required");
  else if (!LEVELS.includes(level as Level)) {
    c.fail("level", `must be one of ${LEVELS.join(", ")}`);
  }

  const place = c.object(input, "place", "place");
  if (place) {
    c.text(place, "name", "place.name");
    if (place.scene !== undefined) {
      if (isObj(place.scene)) checkScene(c, place.scene, "place.scene");
      else c.fail("place.scene", "must be an object");
    }
    checkList(c, place, "hotspots", "place.hotspots", (h, p) => {
      c.text(h, "id", `${p}.id`);
      c.vec3(h, "position", `${p}.position`);
      c.text(h, "word", `${p}.word`);
      c.text(h, "gloss", `${p}.gloss`);
    });
    checkList(c, place, "signage", "place.signage", (s, p) => {
      c.text(s, "id", `${p}.id`);
      c.vec3(s, "anchor", `${p}.anchor`);
      c.text(s, "text", `${p}.text`);
    });
  }

  const character = c.object(input, "character", "character");
  if (character) {
    c.text(character, "name", "character.name");
    c.text(character, "role", "character.role");
    c.text(character, "persona", "character.persona");
    if (character.voice !== undefined) {
      const voice = character.voice;
      if (!isObj(voice)) c.fail("character.voice", "must be an object");
      else {
        c.optionalText(voice, "tts", "character.voice.tts");
        if (
          voice.rate !== undefined &&
          (typeof voice.rate !== "number" || !(voice.rate > 0))
        ) {
          c.fail("character.voice.rate", "must be a positive number");
        }
      }
    }
  }

  const goal = c.object(input, "goal", "goal");
  if (goal) {
    c.text(goal, "description", "goal.description");
    c.optionalText(goal, "completion", "goal.completion");
    const steps = c.array(goal, "steps", "goal.steps");
    if (steps) {
      if (steps.length === 0) c.fail("goal.steps", "must have at least one step");
      steps.forEach((step, i) => {
        const p = `goal.steps[${i}]`;
        if (!isObj(step)) c.fail(p, "must be an object");
        else {
          c.text(step, "id", `${p}.id`);
          c.text(step, "hint", `${p}.hint`);
        }
      });
    }
  }

  const targets = c.object(input, "targets", "targets");
  if (targets) {
    c.stringArray(targets, "phrases", "targets.phrases", true);
    c.stringArray(targets, "grammar", "targets.grammar", false);
  }

  if (input.reviewed !== undefined) {
    const reviewed = input.reviewed;
    if (!isObj(reviewed)) c.fail("reviewed", "must be an object");
    else {
      c.text(reviewed, "by", "reviewed.by");
      const on = reviewed.on;
      if (on === undefined) c.fail("reviewed.on", "required");
      else if (typeof on !== "string" || !isRealDate(on)) {
        c.fail("reviewed.on", "must be a date in YYYY-MM-DD form");
      }
    }
  }

  if (c.errors.length > 0) return { valid: false, errors: c.errors };

  const listed = input.reviewed !== undefined;
  const warnings = listed
    ? []
    : ["reviewed: missing, so the scenario is unlisted and will not appear in the library"];
  return { valid: true, scenario: input as unknown as Scenario, listed, warnings };
}
