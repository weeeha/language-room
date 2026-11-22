import type { LlmProvider } from "../../providers/llm";
import type { Scenario } from "../../scenario/validate";
import { analyze } from "./analyzer";
import { gate } from "./gate";
import { review } from "./reviewer";
import type { Issue, ReviewedIssue } from "./types";

export { gate, recapIssues, shownIssues } from "./gate";
export type { Issue, IssueType, ReviewedIssue, AnalyzerIssue, Verdict } from "./types";

export async function checkLine(
  deps: { analyzer: LlmProvider; reviewer: LlmProvider },
  input: { line: string; turnId: string; scenario: Scenario; lowConfidenceWords?: string[]; signal?: AbortSignal },
): Promise<Issue[]> {
  const found = await analyze(deps.analyzer, { line: input.line, scenario: input.scenario, signal: input.signal });
  const reviewed: ReviewedIssue[] = await Promise.all(
    found.map((issue) =>
      review(deps.reviewer, { line: input.line, issue, scenario: input.scenario, signal: input.signal }).catch(
        (err: unknown): ReviewedIssue => ({
          ...issue,
          verdict: "unsure",
          reason: `Reviewer failed: ${err instanceof Error ? err.message : String(err)}`,
        }),
      ),
    ),
  );
  return gate(reviewed, { turnId: input.turnId, lowConfidenceWords: input.lowConfidenceWords });
}
