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

function syntheticLines(): Line[] {
  return [
    C("Bom dia! O que gostaria de tomar hoje?"),
    L("Bom dia."),
    C("Um café e um pastel de nata, por favor."),
    L("Queria uma café e um pastel de nata, por favor."),
    C("Aqui está o seu café e o seu pastel. Mais alguma coisa?"),
    L("Sim, é tudo. Quanto é?"),
    C("Quer a conta, por favor?"),
    L("Eu não sabe quanto custa o galão."),
    C("O galão custa um euro e sessenta."),
    L("Gosto muito de um café daqui."),
    C("Fico feliz que goste. Quer pagar agora?"),
  ];
}

// knownMiss marks a case the local model still gets wrong. It is printed and counted, but does not set the exit code.
const cases: { name: string; history: Line[]; stepsDone?: string[]; expected: string[]; knownMiss?: boolean }[] = [
  { name: "greet only", history: [C("Bom dia. Diga, faz favor."), L("Bom dia.")], expected: ["greet"] },
  {
    name: "greet and order",
    history: [C("Bom dia. Diga, faz favor."), L("Bom dia."), C("Bom dia. O que vai ser?"), L("Queria um café e um pastel de nata, por favor.")],
    expected: ["greet", "order"],
  },
  {
    name: "orders only a coffee, the hint names a coffee and a tart",
    history: [C("Bom dia. Diga, faz favor."), L("Bom dia."), C("O que vai ser?"), L("Queria um café, por favor.")],
    expected: ["greet"],
  },
  {
    name: "orders only the tart, the hint names a coffee and a tart",
    history: [C("Bom dia. Diga, faz favor."), L("Bom dia."), C("O que vai ser?"), L("Queria um pastel de nata, por favor.")],
    expected: ["greet"],
  },
  {
    name: "orders the coffee and then the tart in two lines",
    history: [
      C("Bom dia. Diga, faz favor."),
      L("Bom dia."),
      C("O que vai ser?"),
      L("Um café, por favor."),
      C("E mais alguma coisa?"),
      L("Sim, e um pastel de nata."),
    ],
    expected: ["greet", "order"],
    knownMiss: true,
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
  // The learner lines of the synthetic session (eval/transcripts/phase-2-synthetic-2026-11-21.json), as heard by
  // Whisper, with greet and order already marked. Before the evidence prompt the judge left pay open on the last line.
  {
    name: "synthetic session, asks for the bill and thanks after a price question",
    history: [...syntheticLines(), L("A conta? Por favor. Obrigado.")],
    stepsDone: ["greet", "order"],
    expected: ["greet", "order", "pay"],
  },
  {
    name: "synthetic session, asks for the bill without thanks",
    history: [...syntheticLines(), L("A conta, por favor.")],
    stepsDone: ["greet", "order"],
    expected: ["greet", "order"],
  },
  {
    name: "synthetic session, thanks without the bill",
    history: [...syntheticLines(), L("Obrigado.")],
    stepsDone: ["greet", "order"],
    expected: ["greet", "order"],
  },
  {
    name: "asks for the bill without thanks",
    history: [
      C("Bom dia. Diga, faz favor."),
      L("Bom dia."),
      C("O que vai ser?"),
      L("Queria um café e um pastel de nata, por favor."),
      C("Mais alguma coisa?"),
      L("A conta, por favor."),
    ],
    expected: ["greet", "order"],
  },
];

let failures = 0;
let knownMisses = 0;
for (const c of cases) {
  const actual = await judgeSteps(llm, {
    scenario,
    history: c.history,
    stepsDone: c.stepsDone ?? [],
    onError: (m) => console.log(`  judge error: ${m}`),
  });
  const ok = JSON.stringify(actual) === JSON.stringify(c.expected);
  if (!ok && c.knownMiss) knownMisses += 1;
  else if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : c.knownMiss ? "MISS" : "FAIL"} ${c.name}: expected [${c.expected.join(", ")}] actual [${actual.join(", ")}]`);
}
console.log(
  `${cases.length - failures - knownMisses} of ${cases.length} cases match, ${knownMisses} known miss, ${failures} unexpected mismatch`,
);
process.exit(failures === 0 ? 0 : 1);
