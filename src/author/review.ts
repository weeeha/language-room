// Review sign-off (docs/spec.md section 4.1). A fluent reviewer checks the persona, the target
// phrases and the signage text. Pure logic: the rule that clears a sign-off lives here.
import type { Scenario } from "../scenario/validate";
import { buildScenario, type FormState } from "./form";

export const REVIEW_CHECKLIST = [
  "The persona is natural for the place and the level, and has no mistakes.",
  "Every target phrase is correct and natural, with correct spelling and accents.",
  "Every sign text is correct and would be found in this place.",
  "The grammar targets and the words in the scene use the language correctly.",
] as const;

export const REVIEW_CLEARED_NOTICE = "Review cleared because reviewed text changed.";
export const UNREVIEWED_WARNING = "This scenario is not yet reviewed by a fluent speaker. It may contain mistakes.";

/**
 * The text a reviewer signs: persona, target phrases, grammar targets, goal hints, sign text
 * and hotspot words. Coordinates, spawn, the scene file and ids are not part of it.
 */
export function reviewedTextKey(s: Scenario): string {
  return JSON.stringify({
    persona: s.character.persona,
    phrases: s.targets.phrases,
    grammar: s.targets.grammar,
    hints: s.goal.steps.map((x) => x.hint),
    signs: (s.place.signage ?? []).map((x) => x.text),
    words: (s.place.hotspots ?? []).map((x) => x.word),
  });
}

/** Removes the reviewed block when the reviewed text differs from the baseline the review was given on. */
export function clearReviewIfChanged(baseline: Scenario, next: Scenario): { scenario: Scenario; cleared: boolean } {
  if (!next.reviewed || reviewedTextKey(baseline) === reviewedTextKey(next)) return { scenario: next, cleared: false };
  const copy = structuredClone(next);
  delete copy.reviewed;
  return { scenario: copy, cleared: true };
}

/** The same rule on the form state, against the saved scenario. */
export function reconcileReview(state: FormState, saved: Scenario | undefined): { state: FormState; cleared: boolean } {
  if (!state.reviewed || !saved) return { state, cleared: false };
  const result = clearReviewIfChanged(saved, buildScenario(state, saved.version));
  if (!result.cleared) return { state, cleared: false };
  const next = { ...state };
  delete next.reviewed;
  return { state: next, cleared: true };
}

/** Today's date in the browser's time zone, as YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  const y = String(now.getFullYear()).padStart(4, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function reviewLine(reviewed: { by: string; on: string } | undefined): string {
  return reviewed ? `Reviewed by ${reviewed.by} on ${reviewed.on}` : "Not reviewed";
}

export interface SignOffInput {
  by: string;
  on: string;
  confirmed: boolean;
}

/** Why the sign-off cannot be written yet, or null when it can. */
export function signOffProblem(input: SignOffInput): string | null {
  if (!input.by.trim()) return "Enter the reviewer's name or id.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.on) || Number.isNaN(Date.parse(`${input.on}T00:00:00Z`))) return "Enter the date as YYYY-MM-DD.";
  if (!input.confirmed) return "Confirm that you are fluent and checked the items.";
  return null;
}

export function applySignOff(state: FormState, input: SignOffInput): FormState {
  return { ...state, reviewed: { by: input.by.trim(), on: input.on } };
}
