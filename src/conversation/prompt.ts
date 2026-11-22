// Prompt builder for the character (docs/spec.md sections 5.5 and 5.6).
// The instructions are English. The character answers only in the scenario language.
import type { LlmMessage } from "../providers/llm";
import type { Level, Scenario } from "../scenario/validate";
import { MAX_WORDS_PER_SENTENCE } from "./level";

export interface PromptTurn {
  role: "learner" | "character";
  text: string;
}

export interface PromptOptions {
  stepsDone?: string[];
}

const SHORT_REPLY_LEVELS: readonly Level[] = ["A1", "A2"];

function lengthRule(level: Level): string {
  const max = MAX_WORDS_PER_SENTENCE[level];
  const base = `Use sentences of ${max} words or fewer.`;
  return SHORT_REPLY_LEVELS.includes(level)
    ? `${base} Reply with one or two sentences.`
    : base;
}

function localeRule(code: string): string {
  if (code === "pt-PT") {
    return "Use the vocabulary and forms of pt-PT, never Brazilian forms.";
  }
  return `Use the vocabulary and forms of ${code}, not those of other regional varieties.`;
}

function stepLines(scenario: Scenario, stepsDone: string[]): string[] {
  const done = new Set(stepsDone);
  let nextMarked = false;
  return scenario.goal.steps.map((step) => {
    let mark = "[todo]";
    if (done.has(step.id)) {
      mark = "[done]";
    } else if (!nextMarked) {
      mark = "[next]";
      nextMarked = true;
    }
    return `- ${mark} ${step.id}: ${step.hint}`;
  });
}

export function buildCharacterSystemPrompt(scenario: Scenario, opts: PromptOptions = {}): string {
  const { language, level, character, place, goal } = scenario;
  const stepsDone = opts.stepsDone ?? [];
  const allDone = goal.steps.every((s) => stepsDone.includes(s.id));
  const lines: string[] = [];

  lines.push(
    `You are ${character.name}, ${character.role}. You are talking with a language learner at ${place.name}.`,
    `Persona: ${character.persona}`,
    "",
    `Language: reply only in ${language.name} (${language.code}). ${localeRule(language.code)}`,
    `The learner's level is ${level}. ${lengthRule(level)} Use common words and simple grammar that fit ${level}.`,
    "",
    `The learner's goal in this scene: ${goal.description}`,
    "Steps (done steps are marked):",
    ...stepLines(scenario, stepsDone),
    allDone
      ? "All steps are done. Close the scene warmly and let the learner finish."
      : "Keep the conversation moving toward the next step that is not done. Give the learner a natural opening to do it.",
  );

  const signage = place.signage ?? [];
  if (signage.length > 0) {
    lines.push(
      "",
      "Signs in the place that you know and may mention, for example as the menu:",
      ...signage.map((s) => `- ${s.text}`),
    );
  }

  lines.push(
    "",
    "Rules for every reply:",
    "- Do not correct the learner in your reply.",
    "- Stay in character.",
    "- Reply with the spoken line only: no stage directions, no translations, no markdown, no emoji.",
    "- If the learner asks you to repeat, repeat once, with simpler and slower wording.",
    "- If the learner says something you do not understand, ask them kindly to say it again, in the same language.",
  );

  return lines.join("\n");
}

export function buildCharacterMessages(
  scenario: Scenario,
  history: PromptTurn[],
  opts: PromptOptions = {},
): LlmMessage[] {
  return [
    { role: "system", content: buildCharacterSystemPrompt(scenario, opts) },
    ...history.map(
      (turn): LlmMessage => ({
        role: turn.role === "learner" ? "user" : "assistant",
        content: turn.text,
      }),
    ),
  ];
}

/**
 * The line the character says after a quiet stretch. It gets the conversation so far, so it does not
 * greet again or repeat itself.
 */
export function buildSilencePrompt(
  scenario: Scenario,
  opts: PromptOptions = {},
  history: PromptTurn[] = [],
): LlmMessage[] {
  return [
    ...buildCharacterMessages(scenario, history, opts),
    {
      role: "user",
      content: `The learner has said nothing for 20 seconds. Say one short, gentle line in character, in ${scenario.language.name}, to invite them to go on. Do not greet them again and do not repeat a line you already said. Do not mention that they were silent for a long time.`,
    },
  ];
}
