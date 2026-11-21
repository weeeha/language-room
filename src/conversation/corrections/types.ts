export type IssueType = "grammar" | "vocabulary" | "word-order" | "register" | "pronunciation-suspected";
export type Verdict = "correct" | "incorrect" | "unsure";

export interface AnalyzerIssue {
  span: string;
  type: IssueType;
  suggestion: string;
  rule: string;
}

export interface ReviewedIssue extends AnalyzerIssue {
  verdict: Verdict;
  reason: string;
  varietyNote?: boolean;
}

export interface Issue extends ReviewedIssue {
  id: string;
  turnId: string;
  shown: boolean;
  held?: "possibly-misheard";
}

export const ISSUE_TYPES: readonly IssueType[] = [
  "grammar",
  "vocabulary",
  "word-order",
  "register",
  "pronunciation-suspected",
];
