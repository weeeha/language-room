// Scoring and sheet text for scripts/synthetic-session.ts. Pure, so it has a test.
import type { Issue } from "../src/conversation/corrections";
import type { Session, Turn } from "../src/conversation/session";
import type { Recap } from "../src/recap/build";

export interface ScriptError {
  kind: string;
  span: string;
  expected: string;
  correctedLine: string;
}

export interface ScriptLine {
  id: string;
  text: string;
  error?: ScriptError;
}

export interface SheetInput {
  date: string;
  scenarioId: string;
  level: string;
  models: { llm: string; stt: string; tts: string; voice: string };
  session: Session;
  recap: Recap;
  script: ScriptLine[];
  /** Learner turn id to script line id. */
  turnScriptIds: Record<string, string>;
  median: number | null;
}

export interface ErrorResult {
  lineId: string;
  kind: string;
  scripted: string;
  heard: string;
  expected: string;
  status: "caught" | "missed";
  reason: string;
}

export interface Score {
  learnerLines: number;
  heardDiffers: number;
  caught: number;
  missed: number;
  wrongOnCleanLines: number;
  extraShownOnErrorLines: number;
  errors: ErrorResult[];
}

export const HEADER =
  "Synthetic stand-in. The learner voice is the macOS voice Joana, not a person. No fluent speaker has reviewed this sheet. It does not satisfy the real-input test in spec section 8.";

export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function applyIssue(text: string, issue: Issue): string {
  const at = text.toLowerCase().indexOf(issue.span.toLowerCase());
  if (at === -1 || issue.span.trim() === "") return text;
  return text.slice(0, at) + issue.suggestion + text.slice(at + issue.span.length);
}

const learnerTurns = (s: Session): Turn[] => s.turns.filter((t) => t.role === "learner");

export function scoreErrors(input: SheetInput): Score {
  const { session, script, turnScriptIds } = input;
  const lineById = new Map(script.map((l) => [l.id, l]));
  const errors: ErrorResult[] = [];
  let heardDiffers = 0;
  let wrongOnCleanLines = 0;
  let extraShownOnErrorLines = 0;
  for (const turn of learnerTurns(session)) {
    const line = lineById.get(turnScriptIds[turn.id] ?? "");
    if (!line) continue;
    if (norm(turn.text) !== norm(line.text)) heardDiffers += 1;
    const here = session.issues.filter((i) => i.turnId === turn.id);
    const shown = here.filter((i) => i.shown);
    if (!line.error) {
      wrongOnCleanLines += shown.length;
      continue;
    }
    const err = line.error;
    const match = (i: Issue): boolean =>
      norm(i.suggestion) === norm(err.expected) || norm(applyIssue(turn.text, i)) === norm(err.correctedLine);
    const hit = shown.find(match);
    extraShownOnErrorLines += shown.filter((i) => i !== hit).length;
    let reason = "caught";
    if (!hit) {
      if (norm(turn.text) !== norm(line.text)) reason = "the heard text is not the scripted line";
      else if (here.length === 0) reason = "the analyzer found no issue";
      else if (here.some(match)) {
        const held = here.find(match) as Issue;
        reason = `the expected correction was found but not shown (verdict ${held.verdict}${held.held ? `, held: ${held.held}` : ""})`;
      } else reason = "the analyzer flagged something else";
    }
    errors.push({
      lineId: line.id,
      kind: err.kind,
      scripted: line.text,
      heard: turn.text,
      expected: err.expected,
      status: hit ? "caught" : "missed",
      reason,
    });
  }
  return {
    learnerLines: learnerTurns(session).length,
    heardDiffers,
    caught: errors.filter((e) => e.status === "caught").length,
    missed: errors.filter((e) => e.status === "missed").length,
    wrongOnCleanLines,
    extraShownOnErrorLines,
    errors,
  };
}

const cell = (s: string): string => s.replace(/\|/g, "/").replace(/\n/g, " ");
const ms = (n: number | undefined | null): string => (n === undefined || n === null ? "none" : `${Math.round(n)} ms`);

export function buildSheet(input: SheetInput, score: Score): string {
  const { session, recap, script, turnScriptIds } = input;
  const lineById = new Map(script.map((l) => [l.id, l]));
  const out: string[] = [];
  out.push(`# Synthetic session, ${input.scenarioId}, ${input.date}`, "", HEADER, "");
  out.push(
    "## Providers",
    "",
    `- Language model (character, analyzer, reviewer, recap): ${input.models.llm}, local, through the proxy`,
    `- Speech to text: ${input.models.stt}`,
    `- Learner voice: ${input.models.voice}`,
    `- Character speech: ${input.models.tts}. Latency below is time to first text, not to first audio.`,
    `- Level: ${input.level}`,
    "",
    "## Machine summary",
    "",
    `- Scripted errors caught with the expected correction: ${score.caught} of ${score.caught + score.missed}`,
    `- Scripted errors missed: ${score.missed}`,
    `- Corrections shown on lines without a scripted error: ${score.wrongOnCleanLines}`,
    `- Other corrections shown on lines with a scripted error: ${score.extraShownOnErrorLines}`,
    `- Learner lines where the heard text differs from the script: ${score.heardDiffers} of ${score.learnerLines}`,
    `- Median latency: ${ms(input.median)}`,
    `- Steps done: ${session.stepsDone.join(", ") || "none"}. End reason: ${session.endReason ?? "none"}`,
    `- Loop errors: ${session.errors.length}`,
    "",
  );
  for (const e of score.errors) {
    out.push(`- ${e.lineId} (${e.kind}): scripted "${e.scripted}", expected correction "${e.expected}", ${e.status}${e.status === "missed" ? `, because ${e.reason}` : ""}`);
  }
  out.push("", "These numbers come from a model-checked script, not from a person. A shown correction counts as wrong here only when it sits on a line the script made correct. The fluent reviewer decides what is right.", "");

  out.push("## Session, turn by turn", "");
  let n = 0;
  const turns = session.turns;
  turns.forEach((t, i) => {
    if (t.role === "character") {
      n += 1;
      const lvl = t.level ? `${t.level.averageWords.toFixed(1)} words per sentence${t.level.flagged ? " (over the limit)" : ""}` : "no figure";
      const prev = turns[i - 1];
      out.push(`### Character line ${n}${prev ? "" : ", greeting"}`, "", `> ${t.text}`, "", `- ${lvl}`, `- Latency: ${prev ? ms(t.latencyMs) : "not measured for the greeting"}`, "");
      return;
    }
    const line = lineById.get(turnScriptIds[t.id] ?? "");
    const differs = line && norm(line.text) !== norm(t.text);
    out.push(`### Learner line (${line?.id ?? "unscripted"})`, "");
    out.push(`- Scripted: ${line?.text ?? "none"}${line?.error ? ` (scripted error: ${line.error.kind}, expected "${line.error.expected}")` : ""}`);
    out.push(`- Heard: ${t.text}${differs ? " **(differs from the script)**" : ""}`);
    const here = session.issues.filter((x) => x.turnId === t.id);
    const shown = here.filter((x) => x.shown);
    const notShown = here.filter((x) => !x.shown);
    out.push(shown.length === 0 ? "- Corrections shown: none" : "- Corrections shown:");
    for (const x of shown) out.push(`  - "${x.span}" to "${x.suggestion}" (${x.type}). Rule: ${x.rule}. ${x.reason}`);
    out.push(notShown.length === 0 ? "- Issues held or not shown: none" : "- Issues held or not shown:");
    for (const x of notShown) out.push(`  - "${x.span}" to "${x.suggestion}" (${x.type}), verdict ${x.verdict}${x.held ? `, held: ${x.held}` : ""}. ${x.reason}`);
    out.push("");
  });
  const latencies = turns.filter((t) => t.latencyMs !== undefined).map((t) => Math.round(t.latencyMs as number));
  out.push("## Latency", "", `Per reply (ms): ${latencies.join(", ") || "none"}`, `Median: ${ms(input.median)}`, "");
  out.push("## End", "", `Steps done: ${session.stepsDone.join(", ") || "none"}`, `End reason: ${session.endReason ?? "none"}`, "");

  out.push("## Recap", "", "### Phrases used", "");
  out.push(...(recap.phrasesUsed.length === 0 ? ["None."] : recap.phrasesUsed.map((p) => `- ${p}`)), "");
  out.push("### Mistakes", "");
  out.push(...(recap.mistakes.length === 0 ? ["None."] : recap.mistakes.map((m) => `- "${m.learnerText}" to "${m.corrected}" (rule: ${m.rule}). ${m.reason}`)), "");
  out.push("### Practise", "");
  recap.practise.forEach((p, i) => out.push(`${i + 1}. ${p.phrase} (${p.source}). Why: ${p.why} Example: ${p.example}`));
  out.push("", `Summary: ${recap.summary.learnerTurns} learner lines, ${recap.summary.stepsDone} of ${recap.summary.stepsTotal} steps.`, "");

  out.push("## Review sheet for a fluent European Portuguese speaker", "", "Mark one box per row. Leave a box empty when unsure and write a note.", "");
  out.push("### Shown corrections", "", "| # | Learner said | Correction shown | Right | Wrong | Note |", "|---|---|---|---|---|---|");
  let c = 0;
  for (const t of learnerTurns(session)) {
    for (const x of session.issues.filter((y) => y.turnId === t.id && y.shown)) {
      c += 1;
      out.push(`| ${c} | ${cell(t.text)} | ${cell(`${x.span} to ${x.suggestion}`)} |  |  |  |`);
    }
  }
  if (c === 0) out.push("| none shown |  |  |  |  |  |");
  out.push("", "### Character lines", "", "| # | Line | Natural | Not natural | Error found |", "|---|---|---|---|---|");
  let k = 0;
  for (const t of turns.filter((x) => x.role === "character")) {
    k += 1;
    out.push(`| ${k} | ${cell(t.text)} |  |  |  |`);
  }
  out.push("", "### Recap items", "", "| Item | Text | Accurate | Not accurate | Note |", "|---|---|---|---|---|");
  recap.phrasesUsed.forEach((p) => out.push(`| Phrase used | ${cell(p)} |  |  |  |`));
  recap.mistakes.forEach((m) => out.push(`| Mistake | ${cell(`${m.learnerText} to ${m.corrected} (${m.rule})`)} |  |  |  |`));
  recap.practise.forEach((p) => out.push(`| Practise | ${cell(`${p.phrase}, example: ${p.example}`)} |  |  |  |`));
  out.push("", "### Anything the app missed", "", "", "", "Reviewer name and date:", "");

  out.push(
    "## What task 21 could and could not check here",
    "",
    "- Checked by hand by the controller: the scene path in the browser with the sample room, not the cafe. The overlays, the failed state and the signage notice were seen there.",
    "- Not checked: the latency comparison with and without the scene. It needs a real browser session with the cafe scene, which needs the paid scene export. Not done.",
    "- This synthetic run has no scene at all, so its latency says nothing about the scene.",
    "",
  );
  return out.join("\n");
}
