// Maps a scenario to the content of the brief screen. Pure: no DOM.
import type { Scenario } from "../scenario/validate";

export interface BriefWord {
  portuguese: string;
  /** Only set when the scenario carries a gloss for the word. */
  gloss?: string;
}

export interface BriefContent {
  title: string;
  languageName: string;
  langCode: string;
  /** Column heading for the useful words, such as Portuguese. */
  languageHeading: string;
  place: string;
  character: string;
  level: string;
  goal: string;
  steps: string[];
  words: BriefWord[];
}

function sentence(text: string): string {
  const t = text.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function languageHeading(scenario: Scenario): string {
  try {
    const base = scenario.language.code.split("-")[0] ?? scenario.language.code;
    return new Intl.DisplayNames(["en"], { type: "language" }).of(base) ?? scenario.language.name;
  } catch {
    return scenario.language.name;
  }
}

export function briefContent(scenario: Scenario): BriefContent {
  const prompt = scenario.place.scene?.prompt ?? scenario.place.prompt;
  const words: BriefWord[] = [];
  const seen = new Map<string, number>();
  const add = (portuguese: string, gloss?: string): void => {
    const key = portuguese.trim().toLowerCase();
    const at = seen.get(key);
    if (at !== undefined) {
      const existing = words[at];
      if (existing && !existing.gloss && gloss) existing.gloss = gloss;
      return;
    }
    seen.set(key, words.length);
    words.push(gloss ? { portuguese, gloss } : { portuguese });
  };
  for (const phrase of scenario.targets.phrases) add(phrase);
  for (const spot of scenario.place.hotspots ?? []) add(spot.word, spot.gloss);
  return {
    title: scenario.title,
    languageName: scenario.language.name,
    langCode: scenario.language.code,
    languageHeading: languageHeading(scenario),
    place: prompt ? `${scenario.place.name}. ${sentence(prompt)}` : scenario.place.name,
    character: `${scenario.character.name}, ${scenario.character.role}. ${sentence(scenario.character.persona)}`,
    level: scenario.level,
    goal: scenario.goal.description,
    steps: scenario.goal.steps.map((s) => s.hint),
    words,
  };
}

/** Says which provider receives the learner's audio (docs/spec.md section 5.9). */
export function audioNotice(stt: { id: string; label: string; paid: boolean }): string {
  if (stt.id === "stt-whisper-local") return `Audio is sent to ${stt.label} on this computer.`;
  if (stt.id === "stt-browser") {
    return `Audio is sent to ${stt.label}, which your browser may run on its own servers.`;
  }
  return `Audio is sent to ${stt.label}, a hosted service${stt.paid ? " that costs money" : ""}.`;
}

export type MicProblem = "denied" | "none" | "nothing" | "unreachable" | "aborted";

/** Sorts an error from the microphone or the speech service into one of the brief's states. */
export function classifyMicError(e: unknown): MicProblem {
  const name = e instanceof Error || e instanceof DOMException ? e.name : "";
  if (name === "AbortError") return "aborted";
  if (name === "SttPermissionError" || name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return "none";
  if (name === "SttNoSpeechError") return "nothing";
  return "unreachable";
}

/** Exact copy for the microphone problems (draft/CONSTRAINTS.md sections 2.2 and 2.6). */
export const MIC_PROBLEM_COPY: Record<Exclude<MicProblem, "aborted">, { text: string; action?: string }> = {
  denied: {
    text: "Microphone access is blocked. Allow the microphone for this site in your browser settings, then press Try again. The conversation needs the microphone.",
    action: "Try again",
  },
  none: {
    text: "No microphone found. Connect a microphone or headset, then press Check again.",
    action: "Check again",
  },
  unreachable: {
    text: "The speech service did not respond. Check your connection, then press Try again.",
    action: "Try again",
  },
  nothing: { text: "We did not hear anything. Press the microphone and speak again." },
};
