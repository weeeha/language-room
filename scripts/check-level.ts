// Prints the average words per sentence of the character lines in a session export.
// Usage: npm run check:level -- <file.json> [level]. Without a file it reads the newest
// eval/transcripts/phase-2-*.json. Exits 1 when the average is above the level limit.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { levelReport } from "./level-report";

const dir = fileURLToPath(new URL("../eval/transcripts/", import.meta.url));
let file = process.argv[2];
if (!file) {
  const names = (await readdir(dir)).filter((n) => /^phase-2-.*\.json$/.test(n)).sort();
  const last = names.at(-1);
  if (!last) {
    console.error("No session file given and none found in eval/transcripts.");
    process.exit(2);
  }
  file = join(dir, last);
}
const report = levelReport(JSON.parse(await readFile(file, "utf8")), process.argv[3]);
console.log(`file: ${file}`);
report.lines.forEach((l, i) => {
  console.log(`line ${i + 1}: ${l.average.toFixed(1)} words per sentence (${l.words} words, ${l.sentences} sentences)  ${l.text}`);
});
console.log(`average: ${report.average.toFixed(1)} words per sentence over ${report.lines.length} character lines, level ${report.level}, limit ${report.limit}`);
console.log(report.pass ? "ok" : "over the limit");
process.exit(report.pass ? 0 : 1);
