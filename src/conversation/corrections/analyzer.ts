import type { LlmMessage, LlmProvider } from "../../providers/llm";
import type { Scenario } from "../../scenario/validate";
import { extractJson } from "./json";
import { ISSUE_TYPES, type AnalyzerIssue, type IssueType } from "./types";

export function buildAnalyzerMessages(input: { line: string; scenario: Scenario }): LlmMessage[] {
  const { line, scenario } = input;
  const system = [
    "You check one sentence written or spoken by a learner of European Portuguese (pt-PT, as used in Portugal).",
    `Learner level: ${scenario.level}. Scenario: ${scenario.title}. ${scenario.goal.description}`,
    "List only real errors in the learner line. Do not list style preferences.",
    "Forms that are normal in Portugal are not errors, even if Brazilians say it differently. Examples: estar a + infinitive, pequeno-almoço, casa de banho, telemóvel, comboio, enclitic pronouns such as chamo-me.",
    "Missing accents from speech-to-text, punctuation and capital letters are not errors.",
    "If the line is correct, answer with an empty list.",
    `Allowed types: ${ISSUE_TYPES.join(", ")}.`,
    'Answer with strict JSON only, in this shape: {"issues":[{"span":"exact words from the line","type":"grammar","suggestion":"the corrected words","rule":"short rule name"}]}',
    'Correct line: {"issues":[]}',
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: `Learner line: ${line}` },
  ];
}

export function parseAnalyzerOutput(text: string, line: string): AnalyzerIssue[] {
  const data = extractJson(text);
  let list: unknown;
  if (Array.isArray(data)) list = data;
  else if (data && typeof data === "object") list = (data as { issues?: unknown }).issues;
  if (!Array.isArray(list)) return [];
  const out: AnalyzerIssue[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.span !== "string" || typeof r.suggestion !== "string" || typeof r.type !== "string") continue;
    const span = r.span.trim();
    const suggestion = r.suggestion.trim();
    if (!span || !suggestion) continue;
    if (!ISSUE_TYPES.includes(r.type as IssueType)) continue;
    if (!line.includes(span)) continue;
    if (suggestion === span) continue;
    out.push({
      span,
      type: r.type as IssueType,
      suggestion,
      rule: typeof r.rule === "string" ? r.rule.trim() : "",
    });
  }
  return out;
}

export async function analyze(
  llm: LlmProvider,
  input: { line: string; scenario: Scenario; signal?: AbortSignal },
): Promise<AnalyzerIssue[]> {
  const { text } = await llm.complete({
    messages: buildAnalyzerMessages(input),
    temperature: 0.2,
    json: true,
    thinking: true,
    signal: input.signal,
  });
  return parseAnalyzerOutput(text, input.line);
}
