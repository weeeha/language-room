// Copy for a failed character reply (draft/CONSTRAINTS.md section 2.6). Only a timeout says "in time".
export function replyErrorCopy(characterName: string, timedOut: boolean): string {
  return timedOut
    ? `${characterName} did not answer in time. Your line is kept.`
    : `${characterName} could not answer. Your line is kept.`;
}
