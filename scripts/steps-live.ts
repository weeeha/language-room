// Live check of the goal-step judge against the local model through the proxy.
// Start the proxy first. STEPS_BASE_URL defaults to http://127.0.0.1:5188. Exits 1 on a mismatch.
import { readFileSync } from "node:fs";
import { createLocalLlm } from "../src/providers/adapters/llm-local";
import { judgeSteps } from "../src/conversation/steps";
import { validateScenario } from "../src/scenario/validate";

const baseUrl = process.env.STEPS_BASE_URL ?? "http://127.0.0.1:5188";
const parsed = validateScenario(JSON.parse(readFileSync(new URL("../scenarios/lisbon-cafe-pt.json", import.meta.url), "utf8")));
if (!parsed.valid) {
  console.error(parsed.errors.join("\n"));
  process.exit(1);
}
const scenario = parsed.scenario;
const llm = createLocalLlm({ baseUrl });

type Line = { role: "learner" | "character"; text: string };
const L = (text: string): Line => ({ role: "learner", text });
const C = (text: string): Line => ({ role: "character", text });

const cases: { name: string; history: Line[]; expected: string[] }[] = [
  { name: "greet only", history: [C("Bom dia. Diga, faz favor."), L("Bom dia.")], expected: ["greet"] },
  {
    name: "greet and order",
    history: [C("Bom dia. Diga, faz favor."), L("Bom dia."), C("Bom dia. O que vai ser?"), L("Queria um café e um pastel de nata, por favor.")],
    expected: ["greet", "order"],
  },
  {
    name: "asks the price, not the bill",
    history: [
      C("Bom dia. Diga, faz favor."),
      L("Bom dia."),
      C("O que vai ser?"),
      L("Queria um café e um pastel de nata, por favor."),
      C("Mais alguma coisa?"),
      L("Quanto é?"),
    ],
    expected: ["greet", "order"],
  },
  {
    name: "asks for the bill and thanks",
    history: [
      C("Bom dia. Diga, faz favor."),
      L("Bom dia."),
      C("O que vai ser?"),
      L("Queria um café e um pastel de nata, por favor."),
      C("Mais alguma coisa?"),
      L("A conta, por favor. Obrigado."),
    ],
    expected: ["greet", "order", "pay"],
  },
  { name: "empty transcript", history: [], expected: [] },
];

let failures = 0;
for (const c of cases) {
  const actual = await judgeSteps(llm, {
    scenario,
    history: c.history,
    stepsDone: [],
    onError: (m) => console.log(`  judge error: ${m}`),
  });
  const ok = JSON.stringify(actual) === JSON.stringify(c.expected);
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${c.name}: expected [${c.expected.join(", ")}] actual [${actual.join(", ")}]`);
}
console.log(failures === 0 ? "all 5 cases match" : `${failures} of ${cases.length} cases do not match`);
process.exit(failures === 0 ? 0 : 1);
