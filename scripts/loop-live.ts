// Live check of the conversation loop against the local model through the proxy.
// Start the proxy first: PORT=5190 npm run server. Text only, no speech, memory store.
import { readFileSync } from "node:fs";
import { createLocalLlm } from "../src/providers/adapters/llm-local";
import { createConversation, type LoopEvent } from "../src/conversation/loop";
import { checkLevel } from "../src/conversation/level";
import { createMemoryStore, medianLatency } from "../src/conversation/session";
import { validateScenario } from "../src/scenario/validate";
import { buildConfirmedTurn } from "../src/ui/HeardConfirm";

const baseUrl = process.env.LOOP_BASE_URL ?? "http://127.0.0.1:5190";
const lines = [
  "Bom dia.",
  "Queria uma café e um pastel de nata, por favor.",
  "Quanto é?",
  "A conta, por favor. Obrigado.",
];

const parsed = validateScenario(JSON.parse(readFileSync(new URL("../scenarios/lisbon-cafe-pt.json", import.meta.url), "utf8")));
if (!parsed.valid) {
  console.error(parsed.errors.join("\n"));
  process.exit(1);
}
const scenario = parsed.scenario;

const llm = createLocalLlm({ baseUrl });
const conv = createConversation(
  {
    llm,
    analyzer: llm,
    reviewer: llm,
    tts: null,
    store: createMemoryStore(),
    providerIds: { stt: "none", llm: llm.id, analyzer: llm.id, reviewer: llm.id, tts: "none" },
    now: () => performance.now(),
  },
  scenario,
  { lang: scenario.language.code },
);

const startedAt = performance.now();
const log = (text: string): void => console.log(`[${((performance.now() - startedAt) / 1000).toFixed(1)}s] ${text}`);
conv.subscribe((e: LoopEvent) => {
  if (e.type === "issues") {
    if (e.issues.length === 0) log("  issues: none");
    for (const i of e.issues) {
      log(`  issue "${i.span}" -> "${i.suggestion}" [${i.type}] verdict=${i.verdict} shown=${i.shown}${i.held ? ` held=${i.held}` : ""} (${i.reason})`);
    }
  } else if (e.type === "steps") log(`  steps done: ${e.stepsDone.join(", ") || "none"}`);
  else if (e.type === "error") log(`  ERROR ${e.where}: ${e.message}`);
  else if (e.type === "state" && e.state === "ended") log("  state: ended");
});

await conv.start();
const greeting = conv.session.turns.at(-1);
if (greeting) log(`Character (greeting): ${greeting.text}`);

for (const line of lines) {
  const turn = buildConfirmedTurn({ text: line }, null);
  if (!turn) continue;
  log(`Learner: ${line}`);
  await conv.send(turn);
  const reply = conv.session.turns.at(-1);
  if (reply?.role === "character") {
    const lvl = checkLevel(reply.text, scenario.level);
    log(`Character: ${reply.text}`);
    log(`  words per sentence: ${lvl.averageWords.toFixed(1)} (limit ${lvl.limit}, ${lvl.flagged ? "FLAGGED" : "ok"}), latency ${reply.latencyMs?.toFixed(0)} ms`);
  } else {
    log("Character: (no reply)");
  }
  if (conv.session.endReason) break;
}

if (!conv.session.endReason) await conv.end("learner");
const median = medianLatency(conv.session);
console.log("");
console.log(`latencies (ms): ${conv.session.turns.filter((t) => t.latencyMs !== undefined).map((t) => t.latencyMs?.toFixed(0)).join(", ")}`);
console.log(`median latency: ${median === null ? "none" : `${median.toFixed(0)} ms`}`);
console.log(`steps done: ${conv.session.stepsDone.join(", ") || "none"}`);
console.log(`issues: ${conv.session.issues.length} stored, ${conv.session.issues.filter((i) => i.shown).length} shown`);
console.log(`end reason: ${conv.session.endReason}`);
console.log(`errors: ${conv.session.errors.length}`);
