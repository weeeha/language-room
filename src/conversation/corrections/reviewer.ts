import type { LlmMessage, LlmProvider } from "../../providers/llm";
import type { Scenario } from "../../scenario/validate";
import { extractJson } from "./json";
import type { AnalyzerIssue, ReviewedIssue, Verdict } from "./types";

export function buildReviewerMessages(input: { line: string; issue: AnalyzerIssue; scenario: Scenario }): LlmMessage[] {
  const { line, issue, scenario } = input;
  const system = [
    "You are a strict second examiner of European Portuguese (pt-PT). A learner wrote a line. A colleague claims there is a mistake. Judge the claim.",
    `Learner level: ${scenario.level}.`,
    'Answer "correct" only when the learner form is wrong in every standard variety of Portuguese and the suggestion is right.',
    'If the learner form is valid in another variety, for example Brazilian Portuguese, or is valid in Portugal, answer "incorrect". Set varietyNote to true when it is a form of another variety.',
    'If you doubt it at all, answer "unsure".',
    'Answer with strict JSON only: {"verdict":"correct","reason":"one short sentence","varietyNote":false}',
    'The verdict must be one of the words: correct, incorrect, unsure.',
  ].join("\n");
  const user = [
    `Learner line: ${line}`,
    `Claimed mistake: "${issue.span}"`,
    `Suggested fix: "${issue.suggestion}"`,
    `Rule named: ${issue.rule}`,
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function parseReviewerOutput(text: string): { verdict: Verdict; reason: string; varietyNote: boolean } {
  const data = extractJson(text);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { verdict: "unsure", reason: "The reviewer reply could not be read.", varietyNote: false };
  }
  const r = data as Record<string, unknown>;
  const v = typeof r.verdict === "string" ? r.verdict.trim().toLowerCase() : "";
  const verdict: Verdict = v === "correct" || v === "incorrect" || v === "unsure" ? v : "unsure";
  return {
    verdict,
    reason: typeof r.reason === "string" ? r.reason : "",
    varietyNote: r.varietyNote === true,
  };
}

export async function review(
  llm: LlmProvider,
  input: { line: string; issue: AnalyzerIssue; scenario: Scenario; signal?: AbortSignal },
): Promise<ReviewedIssue> {
  const { text } = await llm.complete({
    messages: buildReviewerMessages(input),
    temperature: 0,
    json: true,
    signal: input.signal,
  });
  const parsed = parseReviewerOutput(text);
  const out: ReviewedIssue = { ...input.issue, verdict: parsed.verdict, reason: parsed.reason };
  if (parsed.varietyNote) out.varietyNote = true;
  return out;
}
