// Timestamp log for sentence-chunked speech (task 15).
// Runs speakReply in Node against the proxy with the real local model.
// The speech engine here is a STAND-IN: it plays nothing and only logs "audio start".
// Real audio start in a browser is measured in task 16.
import { readFileSync } from "node:fs";
import { buildCharacterMessages } from "../src/conversation/prompt";
import { speakReply } from "../src/conversation/speak";
import { createLocalLlm } from "../src/providers/adapters/llm-local";
import type { TtsProvider } from "../src/providers/tts";
import { validateScenario } from "../src/scenario/validate";

const base = process.env.TIMING_BASE_URL ?? "http://127.0.0.1:5190";
const line = process.env.TIMING_LINE ?? "Bom dia. Queria um café e um pastel de nata, por favor.";

const result = validateScenario(
  JSON.parse(readFileSync(new URL("../scenarios/lisbon-cafe-pt.json", import.meta.url), "utf8")),
);
if (!result.valid) {
  console.error(result.errors.join("\n"));
  process.exit(1);
}
const scenario = result.scenario;

const t0 = performance.now();
const now = () => performance.now();
const ms = () => Math.round(now() - t0);
const log = (event: string) => console.log(`${String(ms()).padStart(6)} ms  ${event}`);

// Stand-in speech engine: pretends each sentence takes 60 ms per word to say.
const standIn: TtsProvider = {
  kind: "tts",
  id: "tts-stand-in",
  label: "Stand-in (logs only, plays nothing)",
  paid: false,
  async speak(text) {
    log(`audio start (stand-in) "${text}"`);
    const words = text.split(/\s+/).length;
    await new Promise((r) => setTimeout(r, words * 60));
    log(`audio end   (stand-in) "${text}"`);
  },
};

const llm = createLocalLlm({ baseUrl: base });
const messages = buildCharacterMessages(scenario, [{ role: "learner", text: line }]);

log(`request sent to ${base}/api/llm/stream, learner line: "${line}"`);
let first = true;
const out = await speakReply({ llm, tts: standIn, now }, { messages, temperature: 0.4, maxTokens: 1500 }, {
  lang: scenario.language.code,
  rate: scenario.character.voice?.rate,
  onText: (soFar) => {
    if (first) {
      log(`first text delta: "${soFar}"`);
      first = false;
    }
  },
  onTtsError: (e) => log(`tts error: ${String(e)}`),
});
log(`reply complete: "${out.text}"`);

const t = out.timings;
const rel = (v: number | null) => (v === null ? "n/a" : `${Math.round(v - t.requestAt)} ms`);
console.log("");
console.log(`first delta        ${rel(t.firstDeltaAt)}`);
console.log(`first sentence     ${rel(t.firstSentenceAt)}`);
console.log(`first audio start  ${rel(t.firstAudioStartAt)}  (stand-in)`);
console.log(`reply complete     ${rel(t.replyCompleteAt)}`);
console.log(`audio end          ${rel(t.audioEndAt)}  (stand-in)`);
const ahead = t.firstSentenceAt !== null && t.firstSentenceAt < t.replyCompleteAt;
console.log(
  ahead
    ? `first sentence was ready ${Math.round(t.replyCompleteAt - t.firstSentenceAt!)} ms before the reply completed`
    : "first sentence was NOT ready before the reply completed",
);
