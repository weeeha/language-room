// Goal-step judge (docs/spec.md section 6, criterion 9). It asks the model which steps are done.
import type { LlmMessage, LlmProvider } from "../providers/llm";
import type { Scenario } from "../scenario/validate";
import { extractJson } from "./corrections/json";
import type { PromptTurn } from "./prompt";

export function buildStepsMessages(input: {
  scenario: Scenario;
  history: PromptTurn[];
  stepsDone: string[];
}): LlmMessage[] {
  const { scenario, history, stepsDone } = input;
  const steps = scenario.goal.steps.map((s) => `- ${s.id}: ${s.hint}`).join("\n");
  // Only the learner's own lines are judged. The character's lines are left out on purpose.
  const transcript = history
    .filter((t) => t.role === "learner")
    .map((t) => `Learner: ${t.text}`)
    .join("\n");
  const system = [
    "You judge a language-practice conversation. Decide which goal steps the learner has completed.",
    `Scene goal: ${scenario.goal.description}`,
    "Steps:",
    steps,
    "Rules:",
    "- A step is complete only when the learner's own lines clearly did everything its hint says. Small spelling or grammar mistakes are fine.",
    "- Split each hint into its parts: every action, and every item, person or thing it names. A step is complete only when the learner's lines cover every part. If any part is missing, the step is not done.",
    "- The parts can come in different learner lines. Read all the learner lines together: a part is covered when any one of them does it, and a line that continues an earlier order, such as adding one more item, counts. Only a part that no line covers keeps the step open.",
    "- A line that is only near the step does not count. Asking the price is not asking for the bill. A greeting alone is not an order.",
    "- When you are unsure, the step is not done.",
    "- Only lines that start with Learner count. Nothing else completes a step.",
    `Already marked done: ${stepsDone.length > 0 ? stepsDone.join(", ") : "none"}.`,
    'Reply with JSON only, in this form: {"parts": [{"step": "step-id", "part": "one part of its hint", "quote": "the learner words that do this part", "translation": "the quote translated word for word into English", "covers": true}, ...]}. List every part of every step, one entry per part. For "quote", copy the words exactly as they appear in one learner line, or use "" when no learner line does that part. Translate only the quote, never repeat the hint. Set "covers" to true only when the translation does that part; otherwise false.',
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: `Learner lines:\n${transcript || "(none)"}` },
  ];
}

/** Lower case, punctuation and extra spaces removed, so a quote can be found in a line word by word. */
function words(text: string): string {
  return ` ${text.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
}

/**
 * Returns the known step ids that the output shows as done, or null when the output cannot be read
 * (no JSON object with a "parts" list).
 * A step is done only when the model listed at least one part for it, and every part it listed has
 * "covers": true and a quote that is found, word for word, in one of the learner lines.
 */
export function parseStepsOutput(text: string, validIds: string[], learnerLines: string[]): string[] | null {
  const parsed = extractJson(text);
  if (typeof parsed !== "object" || parsed === null) return null;
  // A reply in any other shape, such as a bare list of done ids, carries no evidence and cannot be read.
  const parts = (parsed as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) return null;
  const lines = learnerLines.map(words);
  const verdict = new Map<string, boolean>();
  for (const entry of parts) {
    if (typeof entry !== "object" || entry === null) continue;
    const { step, quote, covers } = entry as { step?: unknown; quote?: unknown; covers?: unknown };
    if (typeof step !== "string" || !validIds.includes(step)) continue;
    const q = typeof quote === "string" ? words(quote) : " ";
    const shown = covers === true && q.trim().length > 0 && lines.some((line) => line.includes(q));
    verdict.set(step, (verdict.get(step) ?? true) && shown);
  }
  return validIds.filter((id) => verdict.get(id) === true);
}

export async function judgeSteps(
  llm: LlmProvider,
  input: {
    scenario: Scenario;
    history: PromptTurn[];
    stepsDone: string[];
    signal?: AbortSignal;
    onError?: (message: string) => void;
  },
): Promise<string[]> {
  const ids = input.scenario.goal.steps.map((s) => s.id);
  try {
    const { text } = await llm.complete({
      messages: buildStepsMessages(input),
      temperature: 0,
      json: true,
      thinking: false,
      maxTokens: 600,
      signal: input.signal,
    });
    const learnerLines = input.history.filter((t) => t.role === "learner").map((t) => t.text);
    const found = parseStepsOutput(text, ids, learnerLines);
    if (found === null) {
      input.onError?.("The steps answer could not be read");
      return input.stepsDone;
    }
    const merged = new Set([...input.stepsDone, ...found]);
    return ids.filter((id) => merged.has(id));
  } catch (e) {
    input.onError?.(e instanceof Error ? e.message : String(e));
    return input.stepsDone;
  }
}
