// Synthetic stand-in for the real-input test (docs/spec.md section 8). It is NOT that test.
// A scripted A2 learner is spoken by the macOS voice Joana, heard by the real local Whisper through the
// proxy, confirmed without edits, and sent through the real conversation loop with the local model.
// It writes eval/transcripts/phase-2-synthetic-<date>.md and .json. Start the proxy first.
// SESSION_BASE_URL defaults to http://127.0.0.1:5188. Audio files live in a temp folder that is deleted.
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { createConversation, type LoopEvent } from "../src/conversation/loop";
import { createMemoryStore, medianLatency, type Session, type Turn } from "../src/conversation/session";
import { createLocalLlm } from "../src/providers/adapters/llm-local";
import type { TtsProvider } from "../src/providers/tts";
import { buildRecap, type Recap } from "../src/recap/build";
import { validateScenario } from "../src/scenario/validate";
import { buildConfirmedTurn } from "../src/ui/HeardConfirm";
import { buildSheet, scoreErrors, type ScriptLine, type SheetInput } from "./synthetic-sheet";

const run = promisify(execFile);
const baseUrl = process.env.SESSION_BASE_URL ?? "http://127.0.0.1:5188";
const root = new URL("../", import.meta.url);

const parsed = validateScenario(JSON.parse(await readFile(new URL("scenarios/lisbon-cafe-pt.json", root), "utf8")));
if (!parsed.valid) {
  console.error(parsed.errors.join("\n"));
  process.exit(1);
}
const scenario = parsed.scenario;
const script = JSON.parse(await readFile(new URL("eval/transcripts/learner-script-pt-PT.json", root), "utf8")) as {
  lines: ScriptLine[];
};

const startedAt = performance.now();
const log = (text: string): void => console.log(`[${((performance.now() - startedAt) / 1000).toFixed(0)}s] ${text}`);

const config = (await (await fetch(`${baseUrl}/api/config`)).json()) as { localLlm?: { model?: string | null } };
const model = config.localLlm?.model ?? "unknown";

// No audio plays here. The stand-in resolves at once, so latency is time to first text.
const noAudioTts: TtsProvider = {
  kind: "tts",
  id: "tts-none-synthetic",
  label: "No-audio stand-in",
  paid: false,
  async speak() {
    // Nothing to play.
  },
};

const llm = createLocalLlm({ baseUrl });
const conv = createConversation(
  {
    llm,
    analyzer: llm,
    reviewer: llm,
    tts: noAudioTts,
    store: createMemoryStore(),
    providerIds: { stt: "stt-whisper-local", llm: llm.id, analyzer: llm.id, reviewer: llm.id, tts: noAudioTts.id },
    now: () => performance.now(),
  },
  scenario,
  { lang: scenario.language.code, voice: scenario.character.voice?.tts, rate: scenario.character.voice?.rate },
);
conv.subscribe((e: LoopEvent) => {
  if (e.type === "error") log(`  loop error (${e.where}): ${e.message}`);
});

async function hear(text: string, dir: string, id: string): Promise<{ text: string; words: { text: string; confidence: number }[] }> {
  const file = join(dir, `${id}.aiff`);
  await run("say", ["-v", "Joana", "-o", file, text]);
  const res = await fetch(`${baseUrl}/api/stt/local?lang=pt`, {
    method: "POST",
    headers: { "content-type": "audio/aiff" },
    body: await readFile(file),
  });
  const data = (await res.json()) as { text?: string; words?: { text: string; confidence: number }[]; error?: string };
  if (!res.ok || typeof data.text !== "string") throw new Error(`STT answered ${res.status} ${data.error ?? ""}`);
  return { text: data.text, words: data.words ?? [] };
}

const dir = await mkdtemp(join(tmpdir(), "lr-synthetic-"));
const heardByTurn = new Map<string, string>();
try {
  await conv.start();
  log(`Character: ${conv.session.turns.at(-1)?.text ?? "(no greeting)"}`);
  for (const line of script.lines) {
    if (conv.session.endReason) break;
    const heard = await hear(line.text, dir, line.id);
    // Confirmed without edits, so a mis-hearing stays in the transcript.
    const confirmed = buildConfirmedTurn({ text: heard.text, words: heard.words }, null);
    log(`Scripted: ${line.text}`);
    log(`Heard:    ${heard.text}`);
    if (!confirmed) {
      log("  nothing heard, line skipped");
      continue;
    }
    await conv.send(confirmed);
    const learner = [...conv.session.turns].reverse().find((t) => t.role === "learner");
    if (learner) heardByTurn.set(learner.id, line.id);
    log(`Character: ${conv.session.turns.at(-1)?.text ?? "(no reply)"}`);
  }
  if (!conv.session.endReason) await conv.end("learner");
} finally {
  await rm(dir, { recursive: true, force: true });
}

const session: Session = conv.session;
log("Building the recap");
const recap: Recap = await buildRecap({ llm, reviewer: llm }, session, scenario);

const date = new Date().toLocaleDateString("en-CA");
const input: SheetInput = {
  date,
  scenarioId: scenario.id,
  level: scenario.level,
  models: { llm: model, stt: "whisper.cpp via /api/stt/local", tts: "none (no-audio stand-in)", voice: "macOS say -v Joana" },
  session,
  recap,
  script: script.lines,
  turnScriptIds: Object.fromEntries(heardByTurn),
  median: medianLatency(session),
};
const score = scoreErrors(input);
const base = join("eval", "transcripts", `phase-2-synthetic-${date}`);
await writeFile(new URL(`${base}.md`, root), buildSheet(input, score));
await writeFile(new URL(`${base}.json`, root), JSON.stringify({ ...input, score }, null, 2) + "\n");

const turns: Turn[] = session.turns;
console.log("");
console.log(`sheet: ${base}.md`);
console.log(`turns: ${turns.length}, end reason: ${session.endReason}, steps done: ${session.stepsDone.join(", ") || "none"}`);
console.log(
  `scripted errors: ${score.caught} caught with the expected correction, ${score.missed} missed, ${score.wrongOnCleanLines} wrong or unneeded corrections on lines without a scripted error`,
);
console.log(`heard text differs from the script on ${score.heardDiffers} of ${score.learnerLines} lines`);
console.log(`median latency: ${input.median === null ? "none" : `${Math.round(input.median)} ms`}`);
console.log(`loop errors: ${session.errors.length}`);
