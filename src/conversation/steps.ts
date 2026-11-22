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
    'Reply with JSON only, in this form: {"missing": ["step-id: part with no learner line", ...], "done": ["step-id", ...]}. First fill "missing" with every part of every hint that no learner line covers, one entry per part, and leave out steps the learner has not tried yet only if you list them as missing too. Then fill "done" with every step id that has no entry in "missing", including the ones already done. Use empty lists when there is nothing to list.',
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: `Learner lines:\n${transcript || "(none)"}` },
  ];
}

/** Returns the known step ids found in the output, or null when the output cannot be read. */
export function parseStepsOutput(text: string, validIds: string[]): string[] | null {
  const parsed = extractJson(text);
  let list: unknown;
  if (Array.isArray(parsed)) list = parsed;
  else if (typeof parsed === "object" && parsed !== null) list = (parsed as { done?: unknown }).done;
  if (!Array.isArray(list)) return null;
  const known = new Set(validIds);
  // A step the model itself listed as having a missing part is never done, even if it is also in "done".
  const open = new Set<string>();
  const missing = typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as { missing?: unknown }).missing : undefined;
  if (Array.isArray(missing)) {
    for (const entry of missing) {
      if (typeof entry === "string") open.add(entry.split(":")[0]?.trim() ?? "");
    }
  }
  const out: string[] = [];
  for (const item of list) {
    if (typeof item === "string" && known.has(item) && !open.has(item) && !out.includes(item)) out.push(item);
  }
  return out;
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
      maxTokens: 300,
      signal: input.signal,
    });
    const found = parseStepsOutput(text, ids);
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
