// Pure logic of the scene section: the file name rule, attaching a scene, and the position of
// each item. The click-to-place maths is reused from src/scene/place.ts. No DOM, no storage.
import { applyPlacement, targetKey, type PlaceTarget, type WorkingPlace } from "../scene/place";
import type { SceneFormat, Vec3 } from "../scenario/validate";
import type { FormState, SceneState } from "./form";

export const SCENE_COST_TEXT =
  "Generating a world and exporting it in World Labs Marble may cost money. This app does not call Marble and does not spend anything.";

export const MARBLE_STEPS = [
  "Copy the prompt below.",
  "In World Labs Marble, generate a world from that text.",
  "Export the splat as an SPZ file with 500k splats.",
  "Put the file in the folder media/<scenario id>/ on this computer.",
  "Attach the file below to place the words and signs.",
] as const;

export const FILE_NOTE =
  "The file is never uploaded or stored by this app. The scenario keeps only its path. Copy the file into media/<scenario id>/ on this computer so the scene can load.";

export const SIGNAGE_REVIEW_NOTE =
  "If large text is visible inside the scene, generate the scene again or crop it out. Learners should read the signs written in this form, not the text in the scene.";

/** The default spawn: standing a little back from the middle, looking ahead. */
export const DEFAULT_SPAWN = { position: [0, 1.6, 2] as Vec3, lookAt: [0, 1.6, -1] as Vec3 };

// ---------- file name to path ----------

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type SceneFile = { ok: true; path: string; format: SceneFormat; name: string } | { ok: false; reason: string };

/**
 * The value for place.scene.file: media/<id>/<safe file name>. Only the last part of what the
 * browser reports is used, characters outside letters, digits, dot, hyphen and underscore become
 * hyphens, and only .spz and .ply are accepted.
 */
export function sceneFilePath(id: string, fileName: string): SceneFile {
  if (!ID_RE.test(id)) return { ok: false, reason: "Enter a scenario id first, so the file path can be made." };
  const base = (fileName.split(/[\\/]/).pop() ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const dot = base.lastIndexOf(".");
  const ext = dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
  if (ext !== "spz" && ext !== "ply") return { ok: false, reason: "Choose a file that ends in .spz or .ply." };
  const stem = base
    .slice(0, dot)
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^[-._]+|[-._]+$/g, "");
  if (!stem) return { ok: false, reason: "The file name has no usable letters or digits." };
  const name = `${stem}.${ext}`;
  return { ok: true, path: `media/${id}/${name}`, format: ext, name };
}

// ---------- scene ----------

export type AttachResult = { ok: true; state: FormState } | { ok: false; reason: string };

/** Attaches a scene file by name. Keeps the spawn of an earlier scene. Never reads the file. */
export function attachScene(state: FormState, fileName: string): AttachResult {
  const file = sceneFilePath(state.id.trim(), fileName);
  if (!file.ok) return file;
  const scene: SceneState = {
    ...(state.scene ?? { spawn: structuredClone(DEFAULT_SPAWN) }),
    file: file.path,
    format: file.format,
    source: "marble",
    spawn: state.scene ? structuredClone(state.scene.spawn) : structuredClone(DEFAULT_SPAWN),
  };
  return { ok: true, state: { ...state, scene } };
}

export function removeScene(state: FormState): FormState {
  return { ...state, scene: null };
}

/** The text to paste into Marble: the place name and the prompt. Falls back to the name alone. */
export function marblePrompt(state: Pick<FormState, "placeName" | "placePrompt">): string {
  const name = state.placeName.trim();
  const prompt = state.placePrompt.trim();
  const end = (t: string): string => (/[.!?]$/.test(t) ? t : `${t}.`);
  if (name && prompt) return `${end(name)} ${end(prompt)}`;
  if (prompt) return end(prompt);
  return name ? end(name) : "";
}

// ---------- positions ----------

export type AuthorTarget = PlaceTarget;

export interface TargetOption {
  target: AuthorTarget;
  key: string;
  label: string;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** The things that can be placed, in the order the list shows them. */
export function placeableTargets(state: FormState): TargetOption[] {
  const out: TargetOption[] = [{ target: { kind: "nametag" }, key: "nametag", label: `Name tag: ${state.characterName.trim() || "character"}` }];
  state.hotspots.forEach((x, i) => {
    const t: AuthorTarget = { kind: "hotspot", id: x.id };
    out.push({ target: t, key: targetKey(t) + `#${i}`, label: `Word: ${x.word.trim() || `word ${i + 1}`}` });
  });
  state.signage.forEach((x, i) => {
    const t: AuthorTarget = { kind: "signage", id: x.id };
    out.push({ target: t, key: targetKey(t) + `#${i}`, label: `Sign: ${x.text.trim() || `sign ${i + 1}`}` });
  });
  return out;
}

export function getPosition(state: FormState, target: AuthorTarget): Vec3 | undefined {
  if (target.kind === "nametag") return state.anchor;
  if (target.kind === "hotspot") return state.hotspots.find((x) => x.id === target.id)?.position;
  return state.signage.find((x) => x.id === target.id)?.anchor;
}

/** True for an item that still has the placeholder position 0, 0, 0 (or a name tag with none). */
export function isUnplaced(state: FormState, target: AuthorTarget): boolean {
  const p = getPosition(state, target);
  return !p || (p[0] === 0 && p[1] === 0 && p[2] === 0);
}

/** Sets the position through the same code the development panel uses. Unknown ids change nothing. */
export function setPosition(state: FormState, target: AuthorTarget, position: Vec3): FormState {
  const work: WorkingPlace = {
    hotspots: structuredClone(state.hotspots),
    signage: structuredClone(state.signage),
    anchor: state.anchor ? [...state.anchor] : undefined,
  };
  const rounded: Vec3 = [round2(position[0]), round2(position[1]), round2(position[2])];
  if (!applyPlacement(work, target, rounded)) return state;
  const next: FormState = { ...state, hotspots: work.hotspots, signage: work.signage };
  if (work.anchor) next.anchor = work.anchor;
  return next;
}

/** Sets one coordinate. A name tag with no position starts from 0, 0, 0. Non-numbers change nothing. */
export function setCoordinate(state: FormState, target: AuthorTarget, axis: 0 | 1 | 2, value: number): FormState {
  if (!Number.isFinite(value)) return state;
  const at: Vec3 = [...(getPosition(state, target) ?? [0, 0, 0])] as Vec3;
  at[axis] = value;
  return setPosition(state, target, at);
}

/** Moves one coordinate by delta. */
export function nudge(state: FormState, target: AuthorTarget, axis: 0 | 1 | 2, delta: number): FormState {
  const at = getPosition(state, target) ?? [0, 0, 0];
  return setCoordinate(state, target, axis, (at[axis] as number) + delta);
}

export function clearNameTag(state: FormState): FormState {
  const next = { ...state };
  delete next.anchor;
  return next;
}

// ---------- spawn ----------

export function setSpawn(state: FormState, position: Vec3, lookAt: Vec3): FormState {
  if (!state.scene) return state;
  const r = (v: Vec3): Vec3 => [round2(v[0]), round2(v[1]), round2(v[2])];
  return { ...state, scene: { ...state.scene, spawn: { position: r(position), lookAt: r(lookAt) } } };
}

export function setSpawnCoordinate(state: FormState, which: "position" | "lookAt", axis: 0 | 1 | 2, value: number): FormState {
  if (!state.scene || !Number.isFinite(value)) return state;
  const spawn = structuredClone(state.scene.spawn);
  spawn[which][axis] = value;
  return setSpawn(state, spawn.position, spawn.lookAt);
}
