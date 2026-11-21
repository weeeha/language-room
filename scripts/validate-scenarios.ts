// Validates every scenarios/*.json file. Unlisted is not a failure.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadScenario } from "../src/scenario/load";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "scenarios");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .sort();

let failed = false;
for (const file of files) {
  const result = loadScenario(readFileSync(join(dir, file), "utf8"));
  if (!result.valid) {
    failed = true;
    console.log(`${file} invalid: ${result.errors.join("; ")}`);
  } else if (result.listed) {
    console.log(`${result.scenario.id} valid, listed`);
  } else {
    console.log(`${result.scenario.id} valid, unlisted (${result.warnings.join("; ")})`);
  }
}
process.exit(failed ? 1 : 0);
