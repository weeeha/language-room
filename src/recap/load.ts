// Loads a session for the recap screen and builds the recap once. The built recap is kept on the session record.
import type { Session, SessionStore } from "../conversation/session";
import type { LlmProvider } from "../providers/llm";
import type { Scenario } from "../scenario/validate";
import { buildRecap, type Recap } from "./build";

export type RecapLoad = { state: "not-found" } | { state: "ready"; recap: Recap; session: Session };

export async function loadRecap(
  deps: { store: SessionStore; llm: LlmProvider; reviewer: LlmProvider; now?: () => number },
  scenario: Scenario,
  sessionId: string,
  opts: { signal?: AbortSignal } = {},
): Promise<RecapLoad> {
  const session = await deps.store.get(sessionId);
  if (!session || session.scenarioId !== scenario.id) return { state: "not-found" };
  if (session.recap && session.recap.sessionId === session.id) return { state: "ready", recap: session.recap, session };
  const recap = await buildRecap(deps, session, scenario, opts);
  // Only a finished session keeps its recap. An open one can still change.
  if (session.endedAt !== undefined) {
    try {
      await deps.store.save({ ...session, recap });
    } catch {
      // The recap still shows. It is built again next time.
    }
  }
  return { state: "ready", recap, session };
}
