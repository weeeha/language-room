// Which issues become correction chips (docs/spec.md section 6, criterion 7). Pure: no DOM.
import type { Issue } from "../conversation/corrections";

export interface ChipData {
  id: string;
  suggestion: string;
  rule: string;
  reason: string;
}

/** Only issues with shown === true. Anything else never reaches the page. */
export function chipsFor(issues: readonly Issue[]): ChipData[] {
  return issues
    .filter((i) => i.shown === true)
    .map((i) => ({ id: i.id, suggestion: i.suggestion, rule: i.rule, reason: i.reason }));
}
