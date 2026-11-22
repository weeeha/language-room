import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkLine } from "../src/conversation/corrections/index";
import type { Issue } from "../src/conversation/corrections/types";
import { createLocalLlm } from "../src/providers/adapters/llm-local";
import type { LlmProvider } from "../src/providers/llm";
import type { Scenario } from "../src/scenario/validate";

const here = dirname(fileURLToPath(import.meta.url));
const baseUrl = process.env.EVAL_BASE_URL ?? "http://127.0.0.1:5188";
const CONCURRENCY = 2;
const TIMEOUT_MS = 60_000;

interface Item {
  id: string;
  level: "A1" | "A2" | "B1" | "B2";
  text: string;
  hasError: boolean;
  errorSpan: string | null;
  corrected: string;
  rule: string;
}

const args = new Set(process.argv.slice(2));
const bypassReviewer = args.has("--bypass-reviewer");
const flagEverything = args.has("--flag-everything");

const stats = { calls: 0, callFailures: 0 };

// One call with a per call timeout and one retry.
function guarded(inner: LlmProvider): LlmProvider {
  return {
    ...inner,
    async complete(req) {
      let lastErr: unknown;
      for (let attempt = 0; attempt < 2; attempt++) {
        stats.calls += 1;
        try {
          return await inner.complete({ ...req, signal: AbortSignal.timeout(TIMEOUT_MS) });
        } catch (err) {
          stats.callFailures += 1;
          lastErr = err;
        }
      }
      throw lastErr;
    },
  };
}

const fakeProvider = (id: string, reply: (req: { user: string }) => string): LlmProvider => ({
  kind: "llm",
  id,
  label: id,
  paid: false,
  async complete(req) {
    stats.calls += 1;
    const user = req.messages.find((m) => m.role === "user")?.content ?? "";
    return { text: reply({ user }) };
  },
});

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function leadsToCorrection(item: Item, issue: Issue): boolean {
  const applied = norm(item.text.replace(issue.span, issue.suggestion));
  const target = norm(item.corrected);
  if (applied === target) return true;
  const sug = norm(issue.suggestion);
  return sug.length > 0 && target.includes(sug) && !norm(item.text).includes(sug);
}

const scenarioFor = (level: Item["level"]): Scenario =>
  ({
    id: "gold",
    version: 1,
    title: "General conversation in Portugal",
    language: { code: "pt-PT", name: "European Portuguese" },
    level,
    place: { name: "Portugal" },
    character: { name: "Rui", role: "local", persona: "Friendly local" },
    goal: { description: "Talk about everyday things", steps: [] },
    targets: { phrases: [], grammar: [] },
  }) as Scenario;

async function modelName(): Promise<string> {
  try {
    const res = await fetch(`${process.env.EVAL_MODEL_URL ?? "http://127.0.0.1:11434/v1"}/models`, { signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as { data?: { id?: string }[] };
    return data.data?.[0]?.id ?? "unknown";
  } catch {
    return "unknown";
  }
}

interface Row {
  item: Item;
  issues: Issue[];
  error?: string;
}

async function main(): Promise<void> {
  const set = JSON.parse(await readFile(join(here, "gold-pt-PT.json"), "utf8")) as { items: Item[]; status: string };
  const local = createLocalLlm({ baseUrl });
  const analyzer = flagEverything
    ? fakeProvider("fake-flag-everything", ({ user }) => {
        const line = user.replace(/^Learner line:\s*/, "");
        const first = line.split(/\s+/)[0] ?? "";
        return JSON.stringify({ issues: [{ span: first, type: "grammar", suggestion: `${first}x`, rule: "fake" }] });
      })
    : guarded(local);
  const reviewer = bypassReviewer
    ? fakeProvider("fake-bypass-reviewer", () => '{"verdict":"correct","reason":"bypassed","varietyNote":false}')
    : guarded(local);

  const rows: Row[] = new Array(set.items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < set.items.length) {
      const idx = next++;
      const item = set.items[idx] as Item;
      try {
        const issues = await checkLine(
          { analyzer, reviewer },
          { line: item.text, turnId: item.id, scenario: scenarioFor(item.level) },
        );
        rows[idx] = { item, issues };
      } catch (err) {
        rows[idx] = { item, issues: [], error: err instanceof Error ? err.message : String(err) };
      }
      process.stdout.write(".");
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  process.stdout.write("\n");

  let shownOnCorrect = 0;
  let caught = 0;
  let missed = 0;
  let wrongFixes = 0;
  let unsure = 0;
  let dropped = 0;
  let failures = 0;
  const shownOnCorrectCases: Row[] = [];
  for (const row of rows) {
    if (row.error) failures += 1;
    for (const i of row.issues) {
      if (i.verdict === "unsure" && !i.shown) unsure += 1;
      if (i.verdict === "incorrect") dropped += 1;
    }
    const shown = row.issues.filter((i) => i.shown);
    if (!row.item.hasError) {
      if (shown.length > 0) {
        shownOnCorrect += shown.length;
        shownOnCorrectCases.push(row);
      }
    } else if (!row.error) {
      const good = shown.filter((i) => leadsToCorrection(row.item, i));
      if (good.length > 0) caught += 1;
      else missed += 1;
      wrongFixes += shown.length - good.length;
    }
  }

  const model = await modelName();
  const providerNames = `analyzer: ${analyzer.id}, reviewer: ${reviewer.id}`;
  const lines = [
    `sentences run: ${rows.length - failures} of ${rows.length}`,
    `corrections shown on correct sentences: ${shownOnCorrect}`,
    `errors caught: ${caught} of ${set.items.filter((i) => i.hasError).length}`,
    `errors missed: ${missed}`,
    `wrong fixes shown on error sentences: ${wrongFixes}`,
    `issues held as unsure: ${unsure}`,
    `issues dropped as incorrect: ${dropped}`,
    `calls made: ${stats.calls}`,
    `failures: ${failures} sentences, ${stats.callFailures} calls`,
  ];
  console.log(lines.join("\n"));

  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const suffix = bypassReviewer && flagEverything ? "-bypass" : "";
  const file = join(here, `results-${date}${suffix}.md`);
  const md = [
    `# Gold set results, ${date}${suffix ? " (bypass proof run)" : ""}`,
    "",
    `Gold set status: ${set.status}.`,
    `Providers: ${providerNames}.`,
    `Model: ${model} (local, via ${baseUrl}).`,
    `Flags: ${[bypassReviewer && "--bypass-reviewer", flagEverything && "--flag-everything"].filter(Boolean).join(" ") || "none"}.`,
    "Paid run with Claude: skipped, it needs the owner's approval.",
    "",
    "## Numbers",
    "",
    ...lines.map((l) => `- ${l}`),
    "",
    "## Corrections shown on correct sentences",
    "",
    ...(shownOnCorrectCases.length === 0
      ? ["None."]
      : shownOnCorrectCases.flatMap((r) => [
          `### ${r.item.id}: ${r.item.text}`,
          "",
          ...r.issues.map(
            (i) =>
              `- span "${i.span}", suggestion "${i.suggestion}", type ${i.type}, rule ${i.rule}, verdict ${i.verdict}, shown ${i.shown}, reason: ${i.reason}`,
          ),
          "",
        ])),
    "",
    ...(failures > 0
      ? ["## Failed sentences", "", ...rows.filter((r) => r.error).map((r) => `- ${r.item.id}: ${r.error}`), ""]
      : []),
  ].join("\n");
  await writeFile(file, md);
  console.log(`results written to ${file}`);
  process.exit(shownOnCorrect > 0 || failures > 0 ? 1 : 0);
}

await main();
