import type { Issue, ReviewedIssue } from "./types";

function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

let counter = 0;
const defaultId = (): string => `issue-${Date.now().toString(36)}-${++counter}`;

export function gate(
  reviewed: ReviewedIssue[],
  ctx: { turnId: string; lowConfidenceWords?: string[]; makeId?: () => string },
): Issue[] {
  const low = new Set((ctx.lowConfidenceWords ?? []).flatMap(words));
  const makeId = ctx.makeId ?? defaultId;
  return reviewed.map((r) => {
    const misheard = words(r.span).some((w) => low.has(w));
    const issue: Issue = {
      ...r,
      id: makeId(),
      turnId: ctx.turnId,
      shown: r.verdict === "correct" && !misheard && r.varietyNote !== true,
    };
    if (misheard) issue.held = "possibly-misheard";
    return issue;
  });
}

export function shownIssues(issues: Issue[]): Issue[] {
  return issues.filter((i) => i.shown === true);
}

export function recapIssues(issues: Issue[]): Issue[] {
  return issues.filter((i) => i.verdict === "correct" && i.shown === true && i.held === undefined);
}
