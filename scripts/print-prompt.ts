// Prints the assembled character system prompt for the cafe scenario.
import { readFileSync } from "node:fs";
import { buildCharacterSystemPrompt } from "../src/conversation/prompt";
import { validateScenario } from "../src/scenario/validate";

const url = new URL("../scenarios/lisbon-cafe-pt.json", import.meta.url);
const result = validateScenario(JSON.parse(readFileSync(url, "utf8")));
if (!result.valid) {
  console.error(result.errors.join("\n"));
  process.exit(1);
}
console.log(buildCharacterSystemPrompt(result.scenario));
