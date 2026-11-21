// The recap asks the reviewer one question per example sentence: is it correct in the scenario language.
import type { LlmMessage, LlmProvider } from "../providers/llm";
import type { Scenario } from "../scenario/validate";
import { parseReviewerOutput } from "../conversation/corrections/reviewer";

export function buildExampleMessages(example: string, scenario: Scenario): LlmMessage[] {
  const system = [
    `You are a strict examiner of ${scenario.language.name}. A teacher wrote one example sentence for a learner at level ${scenario.level}.`,
    `Judge whether the sentence is correct, natural ${scenario.language.name}.`,
    'Answer "correct" only when you are sure. If it has a mistake, answer "incorrect". If you doubt it at all, answer "unsure".',
    'Answer with strict JSON only: {"verdict":"correct","reason":"one short sentence"}',
    "The verdict must be one of the words: correct, incorrect, unsure.",
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: `Example sentence: ${example}` },
  ];
}

/** True only when the reviewer answers correct. A failure counts as a rejection. */
export async function exampleIsCorrect(
  reviewer: LlmProvider,
  example: string,
  scenario: Scenario,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const { text } = await reviewer.complete({
      messages: buildExampleMessages(example, scenario),
      temperature: 0,
      json: true,
      thinking: true,
      signal,
    });
    return parseReviewerOutput(text).verdict === "correct";
  } catch {
    return false;
  }
}
