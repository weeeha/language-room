// View model for the recap screen. Pure: no DOM, so it runs in Node tests.
import { chipsFor, type ChipData } from "../ui/chips";
import type { Session } from "../conversation/session";
import type { Scenario } from "../scenario/validate";
import type { PractisePhrase, Recap, RecapMistake } from "./build";

export const FIRST_MISTAKES = 5;

export type RecapKind = "full" | "no-mistakes" | "one-turn";

export interface TranscriptLine {
  id: string;
  role: "learner" | "character";
  who: string;
  text: string;
  chips: ChipData[];
}

export interface RecapViewModel {
  heading: string;
  kind: RecapKind;
  intro: string;
  phrasesUsed: string[];
  phrasesEmpty: string;
  mistakes: { total: number; first: RecapMistake[]; rest: RecapMistake[]; note: string | null; empty: string | null };
  practise: PractisePhrase[];
  transcript: TranscriptLine[];
}

export const COPY = {
  noMistakes:
    "No mistakes found in this session. The checker shows only corrections it is sure about, so a quiet recap does not prove every line was perfect.",
  noMistakesOneTurn: "No mistakes found in this turn.",
  noPhrases: "You did not use any target phrase.",
  preparing: "Preparing your recap.",
  error: "The recap could not be built. Your transcript is saved. Press Try again.",
  notFoundTitle: "Session not found",
  notFoundBody: "This session is not saved in this browser.",
} as const;

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export function recapKind(recap: Recap): RecapKind {
  if (recap.summary.learnerTurns <= 1) return "one-turn";
  return recap.mistakes.length === 0 ? "no-mistakes" : "full";
}

function introFor(kind: RecapKind, recap: Recap): string {
  const { learnerTurns, stepsDone, stepsTotal } = recap.summary;
  if (kind === "one-turn") {
    if (learnerTurns === 0) {
      return "You ended before speaking, so there is little to review. Try the full conversation to practise the order and the bill.";
    }
    return "You ended after 1 turn, so there is little to review. Phrases used are listed below. Try the full conversation to practise the order and the bill.";
  }
  return `You spoke ${plural(learnerTurns, "turn", "turns")}. You finished ${stepsDone} of ${stepsTotal} goal steps.`;
}

export function recapViewModel(recap: Recap, session: Session, scenario: Scenario): RecapViewModel {
  const kind = recapKind(recap);
  const total = recap.mistakes.length;
  const first = recap.mistakes.slice(0, FIRST_MISTAKES);
  const rest = recap.mistakes.slice(FIRST_MISTAKES);
  let empty: string | null = null;
  if (total === 0) empty = kind === "one-turn" ? COPY.noMistakesOneTurn : COPY.noMistakes;
  return {
    heading: `Recap, ${scenario.title}`,
    kind,
    intro: introFor(kind, recap),
    phrasesUsed: recap.phrasesUsed,
    phrasesEmpty: COPY.noPhrases,
    mistakes: {
      total,
      first,
      rest,
      note: total > FIRST_MISTAKES ? `Showing the first ${FIRST_MISTAKES} of ${total} mistakes. Scroll for the rest.` : null,
      empty,
    },
    practise: recap.practise,
    transcript: session.turns.map((t) => ({
      id: t.id,
      role: t.role,
      who: t.role === "character" ? scenario.character.name : "You",
      text: t.text,
      chips: t.role === "learner" ? chipsFor(session.issues.filter((i) => i.turnId === t.id)) : [],
    })),
  };
}
