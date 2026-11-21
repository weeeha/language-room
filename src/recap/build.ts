// Recap builder (docs/spec.md sections 4.3, 5.5 and 5.6, criterion 10). Pure apart from the two model calls.
// The recap never fails because a model failed: every model-written field has a fixed fallback.
import { extractJson } from "../conversation/corrections/json";
import { recapIssues } from "../conversation/corrections";
import type { Session, Turn } from "../conversation/session";
import type { LlmProvider } from "../providers/llm";
import type { Scenario } from "../scenario/validate";
import { exampleIsCorrect } from "./examples";
import { containsPhrase, normalize } from "./text";

export interface RecapMistake {
  learnerText: string;
  corrected: string;
  rule: string;
  reason: string;
  turnId: string;
}

export interface PractisePhrase {
  phrase: string;
  why: string;
  example: string;
  source: "mistake" | "unmet-target" | "target";
}

export interface Recap {
  sessionId: string;
  phrasesUsed: string[];
  mistakes: RecapMistake[];
  practise: PractisePhrase[];
  generatedAt: number;
  summary: { learnerTurns: number; stepsDone: number; stepsTotal: number };
}

export const WHY_TEMPLATES: Record<PractisePhrase["source"], string> = {
  "unmet-target": "You did not reach this phrase in the conversation.",
  mistake: "Practise the corrected form from this session.",
  target: "A useful phrase for this place.",
};

const PRACTISE_COUNT = 3;
const MAX_WHY = 160;
const MAX_EXAMPLE = 160;

const learnerTurns = (session: Session): Turn[] => session.turns.filter((t) => t.role === "learner");

/** Target phrases that appear in a learner turn, in transcript order, without duplicates. */
export function phrasesUsed(session: Session, scenario: Scenario): string[] {
  const shown = recapIssues(session.issues);
  const out: string[] = [];
  for (const turn of learnerTurns(session)) {
    const spans = shown.filter((i) => i.turnId === turn.id).map((i) => i.span);
    for (const phrase of scenario.targets.phrases) {
      if (out.includes(phrase) || !containsPhrase(turn.text, phrase)) continue;
      // An error sits inside the phrase when the span and the phrase share words either way round.
      const broken = spans.some((span) => containsPhrase(phrase, span) || containsPhrase(span, phrase));
      if (!broken) out.push(phrase);
    }
  }
  return out;
}

function replaceSpan(text: string, span: string, suggestion: string): string | undefined {
  if (span.trim() === "") return undefined;
  const at = text.indexOf(span);
  if (at !== -1) return text.slice(0, at) + suggestion + text.slice(at + span.length);
  const lower = text.toLowerCase().indexOf(span.toLowerCase());
  if (lower !== -1) return text.slice(0, lower) + suggestion + text.slice(lower + span.length);
  return undefined;
}

/** Verified mistakes only: verdict correct and shown, not held. */
export function mistakesFrom(session: Session): RecapMistake[] {
  const order = new Map(session.turns.map((t, i) => [t.id, i]));
  const out: { at: number; mistake: RecapMistake }[] = [];
  for (const issue of recapIssues(session.issues)) {
    const turn = session.turns.find((t) => t.id === issue.turnId);
    if (!turn || turn.role !== "learner") continue;
    const corrected = replaceSpan(turn.text, issue.span, issue.suggestion);
    if (corrected === undefined) continue;
    out.push({
      at: order.get(turn.id) ?? 0,
      mistake: { learnerText: turn.text, corrected, rule: issue.rule, reason: issue.reason, turnId: turn.id },
    });
  }
  return out.sort((a, b) => a.at - b.at).map((o) => o.mistake);
}

/** Target phrases the learner did not use, in target order. */
export function unmetTargets(session: Session, scenario: Scenario): string[] {
  const used = new Set(phrasesUsed(session, scenario));
  return scenario.targets.phrases.filter((p) => !used.has(p));
}

type Candidate = { phrase: string; source: PractisePhrase["source"] };

/** Criterion 10: the phrase must appear in a transcript line or in a target phrase. */
function isAuthored(phrase: string, session: Session, scenario: Scenario): boolean {
  if (normalize(phrase) === "") return false;
  return (
    session.turns.some((t) => containsPhrase(t.text, phrase)) ||
    scenario.targets.phrases.some((t) => containsPhrase(t, phrase))
  );
}

/** Keeps the order, but moves phrases the learner already used correctly to the end. */
function usedLast(list: Candidate[], used: Set<string>): Candidate[] {
  return [...list.filter((c) => !used.has(normalize(c.phrase))), ...list.filter((c) => used.has(normalize(c.phrase)))];
}

/**
 * Practise order: phrases from mistakes, then unmet targets, then other targets, then lines
 * the learner said without a correction. Inside each group, a phrase the learner already used
 * correctly comes after the ones they did not.
 */
function candidates(session: Session, scenario: Scenario, mistakes: RecapMistake[]): Candidate[] {
  const used = new Set(phrasesUsed(session, scenario).map(normalize));
  const fromMistakes: Candidate[] = [];
  for (const m of mistakes) {
    const exact = scenario.targets.phrases.find((t) => normalize(t) === normalize(m.corrected));
    if (exact) {
      fromMistakes.push({ phrase: m.corrected, source: "mistake" });
      continue;
    }
    // A longer corrected line is not authored text, so a target inside it is practised instead.
    const contained = scenario.targets.phrases.filter((t) => containsPhrase(m.corrected, t));
    const inside = contained.find((t) => !used.has(normalize(t))) ?? contained[0];
    if (inside) fromMistakes.push({ phrase: inside, source: "mistake" });
  }
  const unmet: Candidate[] = unmetTargets(session, scenario).map((phrase) => ({ phrase, source: "unmet-target" }));
  const others: Candidate[] = scenario.targets.phrases.map((phrase) => ({ phrase, source: "target" }));
  // Last resort for a scenario with very few targets: lines the learner said that carry no correction.
  const flagged = new Set(recapIssues(session.issues).map((i) => i.turnId));
  const lines: Candidate[] = learnerTurns(session)
    .filter((t) => !flagged.has(t.id))
    .map((t) => ({ phrase: t.text.trim(), source: "target" }));
  return [...usedLast(fromMistakes, used), ...usedLast(unmet, used), ...usedLast(others, used), ...lines];
}

function choose(session: Session, scenario: Scenario, mistakes: RecapMistake[]): Candidate[] {
  const chosen: Candidate[] = [];
  const seen = new Set<string>();
  for (const c of candidates(session, scenario, mistakes)) {
    const key = normalize(c.phrase);
    if (seen.has(key) || !isAuthored(c.phrase, session, scenario)) continue;
    seen.add(key);
    chosen.push(c);
    if (chosen.length === PRACTISE_COUNT) break;
  }
  return chosen;
}

interface Written {
  why?: string;
  example?: string;
}

function cleanLine(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim().replace(/\s+/g, " ");
  if (text === "" || text.length > max) return undefined;
  if (text.includes("!") || text.includes("\u2014")) return undefined;
  return text;
}

async function writeCopy(llm: LlmProvider, picks: Candidate[], scenario: Scenario, signal?: AbortSignal): Promise<Map<string, Written>> {
  const out = new Map<string, Written>();
  if (picks.length === 0) return out;
  const system = [
    `You write short study notes for a learner of ${scenario.language.name} at level ${scenario.level}.`,
    "For each phrase give two fields. why: one short English sentence on why to practise it. example: one short sentence in the learner's language that uses the phrase, at the same level.",
    'Answer with strict JSON only: {"items":[{"phrase":"...","why":"...","example":"..."}]}',
    "Copy each phrase exactly as given. Do not add phrases. Do not use exclamation marks or dashes.",
  ].join("\n");
  const user = picks.map((p, i) => `${i + 1}. ${p.phrase}`).join("\n");
  try {
    const { text } = await llm.complete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.3,
      json: true,
      thinking: false,
      signal,
    });
    const data = extractJson(text);
    const items =
      data && typeof data === "object" && !Array.isArray(data) && Array.isArray((data as { items?: unknown }).items)
        ? ((data as { items: unknown[] }).items)
        : [];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      if (typeof rec.phrase !== "string") continue;
      // Only the model's wording for a phrase we chose is kept. Its phrase text is never used.
      const key = normalize(rec.phrase);
      if (!picks.some((p) => normalize(p.phrase) === key) || out.has(key)) continue;
      out.set(key, { why: cleanLine(rec.why, MAX_WHY), example: cleanLine(rec.example, MAX_EXAMPLE) });
    }
  } catch {
    // The templates cover a failed call. An abort is handled by the caller.
  }
  return out;
}

export async function buildRecap(
  deps: { llm: LlmProvider; reviewer: LlmProvider; now?: () => number },
  session: Session,
  scenario: Scenario,
  opts: { signal?: AbortSignal } = {},
): Promise<Recap> {
  const used = phrasesUsed(session, scenario);
  const mistakes = mistakesFrom(session);
  const picks = choose(session, scenario, mistakes);
  const written = await writeCopy(deps.llm, picks, scenario, opts.signal);

  const practise = await Promise.all(
    picks.map(async (pick): Promise<PractisePhrase> => {
      const w = written.get(normalize(pick.phrase));
      let example = pick.phrase;
      if (w?.example && normalize(w.example) !== normalize(pick.phrase)) {
        if (await exampleIsCorrect(deps.reviewer, w.example, scenario, opts.signal)) example = w.example;
      }
      return { phrase: pick.phrase, why: w?.why ?? WHY_TEMPLATES[pick.source], example, source: pick.source };
    }),
  );
  opts.signal?.throwIfAborted();

  const stepIds = new Set(scenario.goal.steps.map((s) => s.id));
  return {
    sessionId: session.id,
    phrasesUsed: used,
    mistakes,
    practise,
    generatedAt: (deps.now ?? Date.now)(),
    summary: {
      learnerTurns: learnerTurns(session).length,
      stepsDone: session.stepsDone.filter((id) => stepIds.has(id)).length,
      stepsTotal: scenario.goal.steps.length,
    },
  };
}
