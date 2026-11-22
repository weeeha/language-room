import type { Session } from "../conversation/session";

/** The most recently finished session, or undefined when none has finished. */
export function lastFinishedSession(sessions: readonly Session[]): Session | undefined {
  let best: Session | undefined;
  for (const s of sessions) {
    if (s.endedAt === undefined) continue;
    if (!best || s.endedAt > (best.endedAt ?? 0)) best = s;
  }
  return best;
}
