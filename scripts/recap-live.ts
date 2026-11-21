// Live check of the recap builder against the local model through the proxy. Free providers only.
// Start the proxy first. RECAP_BASE_URL defaults to http://127.0.0.1:5188. Exits 1 on a failed assertion.
import { readFileSync } from "node:fs";
import { createLocalLlm } from "../src/providers/adapters/llm-local";
import type { Session } from "../src/conversation/session";
import { buildRecap } from "../src/recap/build";
import { containsPhrase } from "../src/recap/text";
import { validateScenario } from "../src/scenario/validate";

const baseUrl = process.env.RECAP_BASE_URL ?? "http://127.0.0.1:5188";
const parsed = validateScenario(JSON.parse(readFileSync(new URL("../scenarios/lisbon-cafe-pt.json", import.meta.url), "utf8")));
if (!parsed.valid) {
  console.error(parsed.errors.join("\n"));
  process.exit(1);
}
const scenario = parsed.scenario;
const llm = createLocalLlm({ baseUrl });

// The three sample turns from draft/CONSTRAINTS.md 2.4.
const session: Session = {
  id: "live-1",
  scenarioId: scenario.id,
  scenarioVersion: scenario.version,
  startedAt: 1,
  endedAt: 2,
  endReason: "learner",
  turns: [
    { id: "c0", role: "character", text: "Bom dia. Diga, faz favor.", at: 1 },
    { id: "l1", role: "learner", text: "Bom dia.", at: 2 },
    { id: "c1", role: "character", text: "Bom dia. O que vai ser?", at: 3 },
    { id: "l2", role: "learner", text: "Queria uma café, por favor.", at: 4 },
    { id: "c2", role: "character", text: "Já trago o café. Mais alguma coisa?", at: 5 },
    { id: "l3", role: "learner", text: "Sim, um pastel de nata. Quanto é?", at: 6 },
    { id: "c3", role: "character", text: "São dois euros e trinta.", at: 7 },
  ],
  issues: [
    {
      id: "i1",
      turnId: "l2",
      span: "uma café",
      type: "grammar",
      suggestion: "um café",
      rule: "Article gender",
      verdict: "correct",
      reason: "Café is masculine, so it takes um.",
      shown: true,
    },
    {
      id: "i2",
      turnId: "l3",
      span: "Quanto é",
      type: "register",
      suggestion: "Quanto custa",
      rule: "Word choice",
      verdict: "unsure",
      reason: "Not sure.",
      shown: false,
    },
  ],
  stepsDone: ["greet", "order"],
  providers: { stt: "", llm: llm.id, analyzer: llm.id, reviewer: llm.id, tts: "" },
  errors: [],
};

const started = Date.now();
const recap = await buildRecap({ llm, reviewer: llm }, session, scenario);
console.log(JSON.stringify(recap, null, 2));
console.log(`built in ${Date.now() - started} ms`);

const failures: string[] = [];
if (recap.practise.length !== 3) failures.push(`expected 3 practise phrases, got ${recap.practise.length}`);
for (const p of recap.practise) {
  const ok =
    session.turns.some((t) => containsPhrase(t.text, p.phrase)) ||
    scenario.targets.phrases.some((t) => containsPhrase(t, p.phrase));
  if (!ok) failures.push(`practise phrase not in transcript or targets: ${p.phrase}`);
}
if (JSON.stringify(recap).includes("Quanto custa")) failures.push("the unsure issue appears in the recap");
if (recap.mistakes.length !== 1) failures.push(`expected 1 mistake, got ${recap.mistakes.length}`);
if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("recap checks pass: 3 practise phrases, all in transcript or targets, unsure issue absent");
